export type DiagnosticTemplateSelectionMode = 'single' | 'multiple';

export type DiagnosticTemplateQuestionType = 'multiple-choice' | 'nested-options' | 'ranked-options';

export type DiagnosticTemplateVisibilityMatchMode = 'any' | 'all';

export type DiagnosticTemplateVisibilityRule = {
  readonly sourceQuestionId: string;
  readonly optionIds: readonly string[];
  readonly match: DiagnosticTemplateVisibilityMatchMode;
} | null;

export type DiagnosticTemplateOptionPresentationValue = {
  readonly icon: string | null;
  readonly badgeText: string | null;
  readonly eyebrow: string | null;
  readonly title: string | null;
  readonly supportingText: string | null;
  readonly exampleBullets: readonly string[];
  readonly panelTitle: string | null;
};

export type DiagnosticTemplateChildQuestionOptionValue = {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly order: number;
};

export type DiagnosticTemplateChildQuestionValue = {
  readonly id: string;
  readonly prompt: string;
  readonly description: string | null;
  readonly selectionMode: DiagnosticTemplateSelectionMode;
  readonly options: readonly DiagnosticTemplateChildQuestionOptionValue[];
};

export type DiagnosticTemplateOptionValue = {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly order: number;
  /** When true, the customer-facing detail textbox appears only if this option is selected. Only one option per question may be true. */
  readonly requestDetailNoteWhenSelected: boolean;
  readonly showWhen: DiagnosticTemplateVisibilityRule;
  readonly presentation: DiagnosticTemplateOptionPresentationValue;
  readonly childQuestion: DiagnosticTemplateChildQuestionValue | null;
};

export type DiagnosticTemplateQuestionValue = {
  readonly id: string;
  readonly prompt: string;
  readonly description: string | null;
  readonly order: number;
  readonly showWhen: DiagnosticTemplateVisibilityRule;
  readonly type: DiagnosticTemplateQuestionType;
  readonly rankedOptionLimit: number | null;
  readonly selectionMode: DiagnosticTemplateSelectionMode;
  readonly options: readonly DiagnosticTemplateOptionValue[];
};

export type DiagnosticTemplateRoundValue = {
  readonly id: string;
  readonly title: string;
  readonly guidance: string | null;
  readonly order: number;
  readonly showWhen: DiagnosticTemplateVisibilityRule;
  readonly questions: readonly DiagnosticTemplateQuestionValue[];
};

export type DiagnosticTemplateValue = {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly rounds: readonly DiagnosticTemplateRoundValue[];
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

export type DiagnosticTemplateInput = {
  readonly name: string;
  readonly rounds: readonly {
    readonly id: string;
    readonly title: string;
    readonly guidance: string | null;
    readonly showWhen: DiagnosticTemplateVisibilityRule;
    readonly questions: readonly {
      readonly id: string;
      readonly prompt: string;
      readonly description: string | null;
      readonly showWhen: DiagnosticTemplateVisibilityRule;
      readonly type: DiagnosticTemplateQuestionType;
      readonly rankedOptionLimit: number | null;
      readonly selectionMode: DiagnosticTemplateSelectionMode;
      readonly options: readonly {
        readonly id: string;
        readonly label: string;
        readonly description: string | null;
        readonly requestDetailNoteWhenSelected: boolean;
        readonly showWhen: DiagnosticTemplateVisibilityRule;
        readonly presentation: {
          readonly icon: string | null;
          readonly badgeText: string | null;
          readonly eyebrow: string | null;
          readonly title: string | null;
          readonly supportingText: string | null;
          readonly exampleBullets: readonly string[];
          readonly panelTitle: string | null;
        };
        readonly childQuestion: {
          readonly id: string;
          readonly prompt: string;
          readonly description: string | null;
          readonly selectionMode: DiagnosticTemplateSelectionMode;
          readonly options: readonly {
            readonly id: string;
            readonly label: string;
            readonly description: string | null;
          }[];
        } | null;
      }[];
    }[];
  }[];
};

export type PublicDiagnosticTemplateValue = {
  readonly id: string;
  readonly name: string;
  readonly rounds: readonly {
    readonly id: string;
    readonly title: string;
    readonly guidance: string | null;
    readonly showWhen: DiagnosticTemplateVisibilityRule;
    readonly questions: readonly {
      readonly id: string;
      readonly prompt: string;
      readonly description: string | null;
      readonly showWhen: DiagnosticTemplateVisibilityRule;
      readonly type: DiagnosticTemplateQuestionType;
      readonly rankedOptionLimit: number | null;
      readonly selectionMode: DiagnosticTemplateSelectionMode;
      readonly options: readonly {
        readonly id: string;
        readonly label: string;
        readonly description: string | null;
        readonly requestDetailNoteWhenSelected: boolean;
        readonly showWhen: DiagnosticTemplateVisibilityRule;
        readonly presentation: {
          readonly icon: string | null;
          readonly badgeText: string | null;
          readonly eyebrow: string | null;
          readonly title: string | null;
          readonly supportingText: string | null;
          readonly exampleBullets: readonly string[];
          readonly panelTitle: string | null;
        };
        readonly childQuestion: {
          readonly id: string;
          readonly prompt: string;
          readonly description: string | null;
          readonly selectionMode: DiagnosticTemplateSelectionMode;
          readonly options: readonly {
            readonly id: string;
            readonly label: string;
            readonly description: string | null;
          }[];
        } | null;
      }[];
    }[];
  }[];
};
