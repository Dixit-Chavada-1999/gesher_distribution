import XLSX from 'xlsx';

const excelPath = 'D:\\Project Docs\\gesher-distribution\\client document\\Data Ingestion GDC.xlsx';

function parseSheet(worksheet, sheetName) {
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });

  // Find header row (row with "Load #")
  let headerRowIndex = -1;
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row && row.some(cell => cell && String(cell).includes('Load #'))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.log(`No header row found in ${sheetName}`);
    return [];
  }

  const headers = rawData[headerRowIndex];
  const dataRows = rawData.slice(headerRowIndex + 1);

  // Map data rows to objects
  const parsedData = dataRows
    .filter(row => row && row.some(cell => cell !== null && cell !== undefined && cell !== ''))
    .map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        if (header) {
          const cleanHeader = String(header).trim();
          obj[cleanHeader] = row[index];
        }
      });
      return obj;
    });

  return parsedData;
}

try {
  console.log('Reading Excel file:', excelPath);
  const workbook = XLSX.readFile(excelPath);

  const gdc0Data = parseSheet(workbook.Sheets['GDC 0'], 'GDC 0');
  const gdc1Data = parseSheet(workbook.Sheets['GDC 1'], 'GDC 1');

  console.log('\n=== GDC 0 (Galileo Orders) ===');
  console.log(`Total records: ${gdc0Data.length}`);
  console.log('\nSample records:');
  console.log(JSON.stringify(gdc0Data.slice(0, 2), null, 2));

  console.log('\n\n=== GDC 1 (GDC 1 Inventory) ===');
  console.log(`Total records: ${gdc1Data.length}`);
  console.log('\nSample records:');
  console.log(JSON.stringify(gdc1Data.slice(0, 2), null, 2));

  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.log(`GDC 0: ${gdc0Data.length} orders`);
  console.log(`GDC 1: ${gdc1Data.length} orders`);
  console.log(`Total: ${gdc0Data.length + gdc1Data.length} orders`);

  // Customers
  const allCustomers = new Set();
  [...gdc0Data, ...gdc1Data].forEach(row => {
    if (row['Customer']) {
      allCustomers.add(row['Customer']);
    }
  });
  console.log(`\nUnique Customers (${allCustomers.size}):`);
  console.log([...allCustomers].sort());

  // Statuses
  const allStatuses = new Set();
  [...gdc0Data, ...gdc1Data].forEach(row => {
    if (row['Status']) {
      allStatuses.add(row['Status']);
    }
  });
  console.log(`\nUnique Statuses (${allStatuses.size}):`);
  console.log([...allStatuses].sort());

  // Save parsed data to JSON for inspection
  const fs = await import('fs');
  fs.writeFileSync(
    'D:\\Live-Projects\\Gesher-Distribution\\gdc-data-parsed.json',
    JSON.stringify({
      gdc0: gdc0Data,
      gdc1: gdc1Data
    }, null, 2)
  );
  console.log('\n✅ Parsed data saved to: gdc-data-parsed.json');

} catch (error) {
  console.error('Error:', error);
}
