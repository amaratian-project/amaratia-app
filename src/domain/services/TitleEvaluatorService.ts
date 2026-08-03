import { CivicTitle, ITitleRule, TitleEvaluationContext } from '../models/Title';

export class ArchitectTitleRule implements ITitleRule {
  readonly titleId = 'architect';

  evaluate(context: TitleEvaluationContext): CivicTitle | null {
    if (context.isGenesis) {
      return {
        id: this.titleId,
        name: 'Arquitecto de Amaratia',
        icon: '🏛️',
        description: 'Fundador y raíz soberana de la República.',
        category: 'ARCHITECT',
      };
    }
    return null;
  }
}

export class ConsulTitleRule implements ITitleRule {
  readonly titleId = 'consul';

  evaluate(context: TitleEvaluationContext): CivicTitle | null {
    if (context.provinces && context.provinces.length > 0) {
      return {
        id: this.titleId,
        name: 'Cónsul',
        icon: '📜',
        description: 'Miembro activo y dignatario de provincias.',
        category: 'CONSUL',
        details: context.provinces,
      };
    }
    return null;
  }
}

export class CitizenTitleRule implements ITitleRule {
  readonly titleId = 'citizen';

  evaluate(context: TitleEvaluationContext): CivicTitle | null {
    if (context.isGenesis || context.activeVisasCount > 0) {
      return {
        id: this.titleId,
        name: 'Ciudadano de Amaratia',
        icon: '🛡️',
        description: 'Miembro acreditado con plenos derechos cívicos.',
        category: 'CITIZEN',
      };
    }
    return null;
  }
}

export class TouristTitleRule implements ITitleRule {
  readonly titleId = 'tourist';

  evaluate(context: TitleEvaluationContext): CivicTitle | null {
    if (!context.isGenesis && context.activeVisasCount === 0) {
      return {
        id: this.titleId,
        name: 'Turista',
        icon: '🧭',
        description: 'Agrega a un ciudadano a tu red o recibe una visa para transformarte en Ciudadano de Amaratia.',
        category: 'TOURIST',
      };
    }
    return null;
  }
}

/**
 * Motor de Evaluación de Títulos Cívicos (SOLID - Open/Closed Principle).
 * Permite registrar nuevas reglas de títulos dinámicamente sin modificar el motor central.
 */
export class TitleEvaluatorService {
  private rules: ITitleRule[] = [];

  constructor(customRules?: ITitleRule[]) {
    if (customRules && customRules.length > 0) {
      this.rules = customRules;
    } else {
      // Reglas fundacionales por defecto
      this.rules = [
        new ArchitectTitleRule(),
        new ConsulTitleRule(),
        new CitizenTitleRule(),
        new TouristTitleRule(),
      ];
    }
  }

  /**
   * Registra una nueva regla de título cívico (extensibilidad OCP).
   */
  registerRule(rule: ITitleRule): void {
    const existingIndex = this.rules.findIndex(r => r.titleId === rule.titleId);
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule;
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * Evalúa todos los títulos válidos para el contexto de un ciudadano.
   */
  evaluateTitles(context: TitleEvaluationContext): CivicTitle[] {
    const titles: CivicTitle[] = [];
    for (const rule of this.rules) {
      const title = rule.evaluate(context);
      if (title) {
        titles.push(title);
      }
    }
    return titles;
  }

  /**
   * Determina el rol fundamental del usuario ('CITIZEN' o 'TOURIST').
   */
  deriveRole(context: TitleEvaluationContext): 'CITIZEN' | 'TOURIST' {
    if (context.isGenesis || context.activeVisasCount > 0) {
      return 'CITIZEN';
    }
    return 'TOURIST';
  }
}
