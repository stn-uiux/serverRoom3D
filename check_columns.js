import XLSX from 'xlsx';

const workbook = XLSX.readFile('stn-all-1773033080472.xlsx');
const sheet = workbook.Sheets['RegisteredDevices'];
const data = XLSX.utils.sheet_to_json(sheet);
if (data.length > 0) {
    console.log('Columns in RegisteredDevices:', Object.keys(data[0]));
    console.log('First row:', JSON.stringify(data[0], null, 2));
} else {
    console.log('Sheet RegisteredDevices is empty.');
}
