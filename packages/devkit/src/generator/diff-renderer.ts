// packages/devkit/src/generator/diff-renderer.ts
import { GeneratorPlan, DiffPreview, DiffLine } from './types';

export class DiffRenderer {
  /**
   * Generates a deterministic list of DiffPreviews for each artifact in the GeneratorPlan.
   * This is murni read-only and runs entirely in-memory.
   */
  public static render(plan: GeneratorPlan): DiffPreview[] {
    if (!plan) {
      throw new Error('Generator plan is null or undefined');
    }

    const previews: DiffPreview[] = [];

    // GeneratorPlan.artifacts is already sorted by filePath, but we sort it anyway to guarantee determinism
    const sortedArtifacts = [...plan.artifacts].sort((a, b) => a.filePath.localeCompare(b.filePath));

    for (const artifact of sortedArtifacts) {
      const diffLines: DiffLine[] = [];

      if (artifact.action === 'CREATE') {
        diffLines.push({
          type: 'context',
          text: `// Creation of new file: ${artifact.filePath}`,
          lineNumber: 1,
        });
        diffLines.push({
          type: 'addition',
          text: `+ // Template: ${artifact.templateName}`,
          lineNumber: 2,
        });
        diffLines.push({
          type: 'addition',
          text: `+ // Description: ${artifact.description}`,
          lineNumber: 3,
        });
        diffLines.push({
          type: 'addition',
          text: `+ // Contract context: Domain ${plan.contractName} v${plan.ast.version}`,
          lineNumber: 4,
        });
        diffLines.push({
          type: 'addition',
          text: `+ // Applicable Business Types: ${plan.ast.applicableBusinessTypes.join(', ')}`,
          lineNumber: 5,
        });
      } else if (artifact.action === 'MODIFY' || artifact.action === 'APPEND') {
        diffLines.push({
          type: 'context',
          text: `// Modification of existing file: ${artifact.filePath}`,
          lineNumber: 42, // Arbitrary starting context line number for dry-run
        });
        diffLines.push({
          type: 'context',
          text: `   // Existing code environment continues...`,
          lineNumber: 43,
        });
        diffLines.push({
          type: 'addition',
          text: `+ // Proposed: ${artifact.description}`,
          lineNumber: 44,
        });
        diffLines.push({
          type: 'addition',
          text: `+ // Target Model: ${plan.ast.entity.backendPrismaModel}`,
          lineNumber: 45,
        });
      }

      previews.push({
        filePath: artifact.filePath,
        action: artifact.action,
        diffLines,
      });
    }

    return previews;
  }

  /**
   * Helper to format DiffPreviews into a single beautifully-aligned terminal string preview.
   */
  public static renderToString(previews: DiffPreview[], planHash?: string): string {
    let output = '';
    output += `================================================================================\n`;
    output += `TUMBU GENERATOR DRY-RUN PREVIEW${planHash ? ` (Hash: ${planHash})` : ''}\n`;
    output += `================================================================================\n\n`;

    for (const preview of previews) {
      output += `File:   ${preview.filePath}\n`;
      output += `Action: ${preview.action}\n`;
      output += `--------------------------------------------------------------------------------\n`;
      for (const line of preview.diffLines) {
        const prefix = line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' ';
        const cleanText = line.text.startsWith('+') || line.text.startsWith('-') 
          ? line.text.substring(1).trim() 
          : line.text;
        
        output += `${prefix} ${cleanText}\n`;
      }
      output += `--------------------------------------------------------------------------------\n\n`;
    }

    return output.trim();
  }
}
