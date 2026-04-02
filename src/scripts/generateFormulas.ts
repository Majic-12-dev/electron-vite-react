import * as fs from 'fs';

interface ExcelFormula {
    name: string;
    syntax: string;
    description: string;
    category: string;
    example: string;
}

const inputPath = '/data/workspace/repo/src/data/refinedExcelFormulas.json';
const outputPath = '/data/workspace/repo/src/data/excelFormulasFull.ts';

function generate() {
    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const formulas: ExcelFormula[] = JSON.parse(rawData);

    const tsContent = `// Auto-generated Excel Formulas
export interface ExcelFormula {
    name: string;
    syntax: string;
    description: string;
    category: string;
    example: string;
}

export const EXCEL_FORMULAS: ExcelFormula[] = ${JSON.stringify(formulas, null, 4)};
`;

    fs.writeFileSync(outputPath, tsContent);
    console.log(`Generated ${formulas.length} entries in ${outputPath}`);
}

generate();
