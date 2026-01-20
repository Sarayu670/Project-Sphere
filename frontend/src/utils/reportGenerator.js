import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generateChatReport = (chatData, teamName, guideName) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Title
  doc.setFontSize(16);
  doc.text('Project Review Report', pageWidth / 2, 15, { align: 'center' });
  
  // Report metadata - SIMPLIFIED
  doc.setFontSize(11);
  doc.text(`Team: ${teamName}`, 20, 30);
  doc.text(`Guide: ${guideName}`, 20, 40);
  
  // Chat history as table
  const tableData = chatData.messages.map(msg => [
    new Date(msg.timestamp).toLocaleString(),
    msg.senderName,
    msg.text || (msg.fileName ? `[File: ${msg.fileName}]` : '')
  ]);
  
  doc.autoTable({
    head: [['Timestamp', 'Sender', 'Message']],
    body: tableData,
    startY: 55,
    margin: { top: 55 },
    styles: {
      fontSize: 9,
      cellPadding: 5,
      overflow: 'linebreak',
      halign: 'left'
    },
    headStyles: {
      fillColor: [102, 126, 234],
      textColor: 255,
      fontStyle: 'bold'
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    columnStyles: {
      0: { cellWidth: 45 },
      1: { cellWidth: 35 },
      2: { cellWidth: 90 }
    }
  });
  
  // Footer
  doc.setFontSize(8);
  doc.text('This is an automatically generated report from Project Sphere', pageWidth / 2, pageHeight - 10, { align: 'center', textColor: 150 });
  
  // Save the PDF
  doc.save(`Project_Review_Report_${teamName}_${new Date().toISOString().split('T')[0]}.pdf`);
};
