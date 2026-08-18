// packages/devkit/src/generator/artifact-planner.ts
import { GeneratorAST, ArtifactPlan } from './types';

export class ArtifactPlanner {
  /**
   * Generates a list of conceptual ArtifactPlans based on the GeneratorAST.
   * This operation is purely read-only, non-mutating, and deterministic.
   */
  public static plan(ast: GeneratorAST): ArtifactPlan[] {
    if (!ast) {
      throw new Error('AST is null or undefined');
    }

    const artifacts: ArtifactPlan[] = [];

    // Format entity names
    const entityNameKebab = ast.entity.name.replace(/_/g, '-');
    const entityModelPascal = ast.entity.backendPrismaModel;

    // 1. Prisma schema artifact
    artifacts.push({
      filePath: 'apps/api/prisma/schema.prisma',
      action: 'MODIFY',
      description: `Append database model ${entityModelPascal} to schema`,
      templateName: 'prisma-model',
    });

    // 2. NestJS API Controller and Service artifacts
    artifacts.push({
      filePath: `apps/api/src/budidaya/api/${entityNameKebab}.controller.ts`,
      action: 'CREATE',
      description: `Create API Controller for ${ast.contractName} with endpoints to dispatch commands`,
      templateName: 'nest-controller',
    });

    artifacts.push({
      filePath: `apps/api/src/budidaya/application/${entityNameKebab}.service.ts`,
      action: 'CREATE',
      description: `Create application service to orchestrate ${ast.contractName} state and handle command logic`,
      templateName: 'nest-service',
    });

    // 3. Web frontend files (e.g., form view)
    artifacts.push({
      filePath: `apps/web/src/app/aqua-${entityNameKebab}-s02.tsx`,
      action: 'CREATE',
      description: `Create React frontend form for submitting ${ast.contractName} events`,
      templateName: 'react-view',
    });

    // 4. Shared contract references
    artifacts.push({
      filePath: `packages/contracts/src/domains/${entityNameKebab}.contract.ts`,
      action: 'CREATE',
      description: `Add canonical contract definition for ${ast.contractName}`,
      templateName: 'domain-contract',
    });

    // Ensure all planned artifacts are sorted alphabetically by filePath to enforce determinism
    return artifacts.sort((a, b) => a.filePath.localeCompare(b.filePath));
  }
}
