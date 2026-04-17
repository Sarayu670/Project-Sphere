import * as XLSX from 'xlsx';

export function downloadBatchExcelTemplate() {
  // This template matches the format in your screenshot and Book2.xlsx
  const sampleData = [
    {
      'Batch No': 'S19',
      'Roll No': '23251A05M4',
      'Name of the Student': 'P.Sarayu',
      'Year': 3,
      'Branch': 'CSE',
      'Section': 'C',
      'Internal Guide': 'N.Tejaswi',
      'Project Title': 'Project Sphere',
      'Domain': 'Cloud Computing',
      'CoE/RC': 'Cloud Computing',
      'Guide Email': 'pittalasarayu99@gmail.com'
    },
    {
      'Batch No': 'S19',
      'Roll No': '23251A05N3',
      'Name of the Student': 'S.Divya',
      'Year': 3,
      'Branch': 'CSE',
      'Section': 'C',
      'Internal Guide': 'N.Tejaswi',
      'Project Title': 'Project Sphere',
      'Domain': 'Cloud Computing',
      'CoE/RC': 'Cloud Computing',
      'Guide Email': 'pittalasarayu99@gmail.com'
    },
    {
      'Batch No': 'S19',
      'Roll No': '23251A05O6',
      'Name of the Student': 'R.Sravanthi',
      'Year': 3,
      'Branch': 'CSE',
      'Section': 'C',
      'Internal Guide': 'N.Tejaswi',
      'Project Title': 'Project Sphere',
      'Domain': 'Cloud Computing',
      'CoE/RC': 'Cloud Computing',
      'Guide Email': 'pittalasarayu99@gmail.com'
    }
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 10 }, // Batch No
    { wch: 15 }, // Roll No
    { wch: 20 }, // Name of the Student
    { wch: 6 },  // Year
    { wch: 8 },  // Branch
    { wch: 8 },  // Section
    { wch: 18 }, // Internal Guide
    { wch: 20 }, // Project Title
    { wch: 18 }, // Domain
    { wch: 18 }, // CoE/RC
    { wch: 28 }  // Guide Email
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Batch Template');
  XLSX.writeFile(wb, 'Batch_Import_Template.xlsx');
}
