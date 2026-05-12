import { randomUUID } from 'node:crypto';
import { ObjectId, type Collection } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type {
  DiagnosticTemplateDocument,
  DiagnosticTemplateOptionDocument,
  DiagnosticTemplateQuestionDocument,
  DiagnosticTemplateRoundDocument,
} from '@/domain/types';
import type {
  DiagnosticTemplateInput,
  DiagnosticTemplateValue,
  PublicDiagnosticTemplateValue,
} from '@/lib/diagnostic-template-types';
import { getDb } from '@/lib/mongodb';

type DiagnosticTemplateStoredDocument = DiagnosticTemplateDocument & {
  readonly _id: ObjectId;
};

const MIN_PUBLIC_OPTIONS_PER_QUESTION = 2;

function sortOptions(
  options: readonly DiagnosticTemplateOptionDocument[],
): readonly DiagnosticTemplateOptionDocument[] {
  return [...options].sort((left, right) => left.order - right.order);
}

function sortQuestions(
  questions: readonly DiagnosticTemplateQuestionDocument[],
): readonly DiagnosticTemplateQuestionDocument[] {
  return [...questions].sort((left, right) => left.order - right.order);
}

function sortRounds(rounds: readonly DiagnosticTemplateRoundDocument[]): readonly DiagnosticTemplateRoundDocument[] {
  return [...rounds].sort((left, right) => left.order - right.order);
}

function mapTemplateDocument(doc: DiagnosticTemplateStoredDocument): DiagnosticTemplateValue {
  return {
    id: doc._id.toString(),
    name: doc.name,
    isActive: doc.isActive,
    rounds: sortRounds(doc.rounds).map((round) => ({
      id: round.id,
      title: round.title,
      guidance: round.guidance,
      order: round.order,
      questions: sortQuestions(round.questions).map((question) => ({
        id: question.id,
        prompt: question.prompt,
        description: question.description ?? null,
        order: question.order,
        options: sortOptions(question.options).map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description ?? null,
          order: option.order,
        })),
      })),
    })),
    createdAtIso: doc.createdAt.toISOString(),
    updatedAtIso: doc.updatedAt.toISOString(),
  };
}

function buildOptionDocument(
  input: DiagnosticTemplateInput['rounds'][number]['questions'][number]['options'][number],
  order: number,
): DiagnosticTemplateOptionDocument {
  const label = input.label.trim();
  const description = input.description?.trim() ?? '';
  return {
    id: input.id.trim().length > 0 ? input.id.trim() : randomUUID(),
    label,
    description: description.length > 0 ? description : null,
    order,
  };
}

function buildQuestionDocument(
  input: DiagnosticTemplateInput['rounds'][number]['questions'][number],
  order: number,
): DiagnosticTemplateQuestionDocument {
  const description = input.description?.trim() ?? '';
  return {
    id: input.id.trim().length > 0 ? input.id.trim() : randomUUID(),
    prompt: input.prompt.trim(),
    description: description.length > 0 ? description : null,
    order,
    options: input.options.map((option, optionIndex) => buildOptionDocument(option, optionIndex)),
  };
}

function buildRoundDocument(
  input: DiagnosticTemplateInput['rounds'][number],
  order: number,
): DiagnosticTemplateRoundDocument {
  const guidance = input.guidance === null ? null : input.guidance.trim();
  return {
    id: input.id.trim().length > 0 ? input.id.trim() : randomUUID(),
    title: input.title.trim().length > 0 ? input.title.trim() : `Round ${order + 1}`,
    guidance: guidance === null || guidance.length === 0 ? null : guidance,
    order,
    questions: input.questions.map((question, questionIndex) => buildQuestionDocument(question, questionIndex)),
  };
}

function normalizeTemplateInput(input: DiagnosticTemplateInput): Pick<DiagnosticTemplateDocument, 'name' | 'rounds'> {
  const trimmedName = input.name.trim();
  return {
    name: trimmedName.length > 0 ? trimmedName : 'Untitled template',
    rounds: input.rounds.map((round, roundIndex) => buildRoundDocument(round, roundIndex)),
  };
}

function parseTemplateId(templateId: string): ObjectId {
  if (!ObjectId.isValid(templateId)) {
    throw new Error('Invalid diagnostic template id.');
  }
  return new ObjectId(templateId);
}

async function getCollection(): Promise<Collection<DiagnosticTemplateDocument>> {
  const db = await getDb();
  return db.collection<DiagnosticTemplateDocument>(COLLECTIONS.diagnosticTemplates);
}

async function findTemplateDocumentById(templateId: string): Promise<DiagnosticTemplateStoredDocument | null> {
  const collection = await getCollection();
  const objectId = parseTemplateId(templateId);
  const doc = await collection.findOne({ _id: objectId });
  if (doc === null || doc._id === undefined) {
    return null;
  }
  return doc as DiagnosticTemplateStoredDocument;
}

function isValidPublicQuestion(question: DiagnosticTemplateValue['rounds'][number]['questions'][number]): boolean {
  const prompt = question.prompt.trim();
  const validOptions = question.options.filter((option) => option.label.trim().length > 0);
  return prompt.length > 0 && validOptions.length >= MIN_PUBLIC_OPTIONS_PER_QUESTION;
}

function toPublicTemplate(template: DiagnosticTemplateValue): PublicDiagnosticTemplateValue | null {
  const rounds = template.rounds
    .map((round) => ({
      id: round.id,
      title: round.title,
      guidance: round.guidance,
      questions: round.questions
        .filter((question) => isValidPublicQuestion(question))
        .map((question) => ({
          id: question.id,
          prompt: question.prompt.trim(),
          description: question.description?.trim() ? question.description.trim() : null,
          options: question.options
            .filter((option) => option.label.trim().length > 0)
            .map((option) => ({
              id: option.id,
              label: option.label.trim(),
              description: option.description?.trim() ? option.description.trim() : null,
            })),
        })),
    }))
    .filter((round) => round.questions.length > 0);
  if (rounds.length === 0) {
    return null;
  }
  return {
    id: template.id,
    name: template.name,
    rounds,
  };
}

export async function listDiagnosticTemplates(): Promise<readonly DiagnosticTemplateValue[]> {
  if (!process.env.MONGODB_URI) {
    return [];
  }
  const collection = await getCollection();
  const docs = await collection.find().sort({ isActive: -1, updatedAt: -1, createdAt: 1 }).toArray();
  return docs
    .filter((doc): doc is DiagnosticTemplateStoredDocument => doc._id !== undefined)
    .map((doc) => mapTemplateDocument(doc));
}

export async function createDiagnosticTemplate(name?: string): Promise<DiagnosticTemplateValue> {
  const collection = await getCollection();
  const templateCount = await collection.countDocuments();
  const now = new Date();
  const trimmedName = typeof name === 'string' ? name.trim() : '';
  const doc: DiagnosticTemplateDocument = {
    name: trimmedName.length > 0 ? trimmedName : `Untitled template ${templateCount + 1}`,
    isActive: templateCount === 0,
    rounds: [],
    createdAt: now,
    updatedAt: now,
  };
  const result = await collection.insertOne(doc);
  return mapTemplateDocument({
    ...doc,
    _id: result.insertedId,
  });
}

export async function updateDiagnosticTemplate(
  templateId: string,
  input: DiagnosticTemplateInput,
): Promise<DiagnosticTemplateValue> {
  const current = await findTemplateDocumentById(templateId);
  if (current === null) {
    throw new Error('Diagnostic template not found.');
  }
  const normalized = normalizeTemplateInput(input);
  const next: DiagnosticTemplateDocument = {
    name: normalized.name,
    isActive: current.isActive,
    rounds: normalized.rounds,
    createdAt: current.createdAt,
    updatedAt: new Date(),
  };
  const collection = await getCollection();
  await collection.replaceOne({ _id: current._id }, next);
  return mapTemplateDocument({
    ...next,
    _id: current._id,
  });
}

export async function activateDiagnosticTemplate(templateId: string): Promise<DiagnosticTemplateValue> {
  const current = await findTemplateDocumentById(templateId);
  if (current === null) {
    throw new Error('Diagnostic template not found.');
  }
  const collection = await getCollection();
  const now = new Date();
  await collection.updateMany({}, { $set: { isActive: false } });
  await collection.updateOne({ _id: current._id }, { $set: { isActive: true, updatedAt: now } });
  return mapTemplateDocument({
    ...current,
    isActive: true,
    updatedAt: now,
  });
}

export async function deleteDiagnosticTemplate(templateId: string): Promise<void> {
  const current = await findTemplateDocumentById(templateId);
  if (current === null) {
    throw new Error('Diagnostic template not found.');
  }
  if (current.isActive) {
    throw new Error('Activate a different template before deleting this one.');
  }
  const collection = await getCollection();
  await collection.deleteOne({ _id: current._id });
}

export async function getActiveDiagnosticTemplate(): Promise<DiagnosticTemplateValue | null> {
  if (!process.env.MONGODB_URI) {
    return null;
  }
  const collection = await getCollection();
  const activeDoc = await collection.findOne({ isActive: true }, { sort: { updatedAt: -1, createdAt: 1 } });
  if (activeDoc !== null && activeDoc._id !== undefined) {
    return mapTemplateDocument(activeDoc as DiagnosticTemplateStoredDocument);
  }
  const fallbackDoc = await collection.findOne({}, { sort: { updatedAt: -1, createdAt: 1 } });
  if (fallbackDoc === null || fallbackDoc._id === undefined) {
    return null;
  }
  return mapTemplateDocument(fallbackDoc as DiagnosticTemplateStoredDocument);
}

export async function getPublicActiveDiagnosticTemplate(): Promise<PublicDiagnosticTemplateValue | null> {
  const activeTemplate = await getActiveDiagnosticTemplate();
  if (activeTemplate === null) {
    return null;
  }
  return toPublicTemplate(activeTemplate);
}
