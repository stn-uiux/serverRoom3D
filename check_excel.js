import XLSX from 'xlsx';
import fs from 'fs';

const workbook = XLSX.readFile('stn-all-1773033080472.xlsx');
console.log('Sheets:', workbook.SheetNames);

if (workbook.SheetNames.includes('t_device')) {
    const sheet = workbook.Sheets['t_device'];
    const data = XLSX.utils.sheet_to_json(sheet).slice(0, 5); // 첫 5줄 출력
    console.log('Sample data from t_device:', JSON.stringify(data, null, 2));
} else {
    console.log('Sheet t_device not found.');
}
