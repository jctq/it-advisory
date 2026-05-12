export type DiagnosticTemplateOptionValue = {
  readonly id: string;
  readonly label: string;
  readonly description: string | null;
  readonly order: number;
};

export type DiagnosticTemplateQuestionValue = {
  readonly id: string;
  readonly prompt: string;
  readonly description: string | null;
  readonly order: number;
  readonly options: readonly DiagnosticTemplateOptionValue[];
};

export type DiagnosticTemplateRoundValue = {
  readonly id: string;
  readonly title: string;
  readonly guidance: string | null;
  readonly order: number;
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
    readonly questions: readonly {
      readonly id: string;
      readonly prompt: string;
      readonly description: string | null;
      readonly options: readonly {
        readonly id: string;
        readonly label: string;
        readonly description: string | null;
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
    readonly questions: readonly {
      readonly id: string;
      readonly prompt: string;
      readonly description: string | null;
      readonly options: readonly {
        readonly id: string;
        readonly label: string;
        readonly description: string | null;
      }[];
    }[];
  }[];
};
