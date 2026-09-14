import XLSX from 'xlsx';

const filePath = 'D:\\Project Docs\\gesher-distribution\\client document\\Data Ingestion GDC.xlsx';

console.log('Reading Excel file:', filePath);

try {
  const workbook = XLSX.readFile(filePath);

  console.log('\n=== Sheets in Workbook ===');
  console.log(workbook.SheetNames);

  // Read each sheet
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n\n=== Sheet: ${sheetName} ===`);

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log(`Total Rows: ${data.length}`);

    if (data.length > 0) {
      console.log('\nColumns:');
      console.log(Object.keys(data[0]).join(', '));

      console.log('\nFirst 3 rows:');
      console.log(JSON.stringify(data.slice(0, 3), null, 2));
    }
  });

} catch (error) {
  console.error('Error reading file:', error.message);
}
