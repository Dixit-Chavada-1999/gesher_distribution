import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const excelPath = 'D:\\Project Docs\\gesher-distribution\\client document\\Data Ingestion GDC.xlsx';

try {
  console.log('Reading Excel file:', excelPath);
  const workbook = XLSX.readFile(excelPath);

  console.log('\n=== SHEET NAMES ===');
  console.log(workbook.SheetNames);

  workbook.SheetNames.forEach((sheetName) => {
    console.log(`\n\n=== SHEET: ${sheetName} ===`);
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    console.log(`Total rows: ${data.length}`);

    if (data.length > 0) {
      console.log('\nColumns:', Object.keys(data[0]));
      console.log('\nFirst 3 rows:');
      console.log(JSON.stringify(data.slice(0, 3), null, 2));

      console.log(`\nLast 3 rows:`);
      console.log(JSON.stringify(data.slice(-3), null, 2));
    }
  });

} catch (error) {
  console.error('Error reading Excel:', error);
}
