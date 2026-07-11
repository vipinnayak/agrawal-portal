import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export default function generateEmployeePDF(form, employeeId) {

  const doc = new jsPDF();

  // Header
  doc.setFontSize(22);
  doc.setTextColor(30,64,175);
  doc.text("AGRAWAL JAIN & CO.",105,18,{align:"center"});

  doc.setFontSize(16);
  doc.setTextColor(90);
  doc.text("Employee Profile",105,28,{align:"center"});

  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`Employee ID : ${employeeId}`,14,40);
//   doc.text(`Generated : ${new Date().toLocaleDateString()}`,140,40);

  // ===== Passport Photo =====
  if(form.PassportPhoto){

    try{

      const type = form.PassportPhoto.startsWith("data:image/png")
        ? "PNG"
        : "JPEG";

      doc.addImage(
        form.PassportPhoto,
        type,
        160,
        12,
        32,
        40
      );

    }catch(err){

      console.log("Image Error",err);

    }

  }

  autoTable(doc,{
    startY:55,

    head:[["Field","Response"]],

    body:[
      ["Candidate Name",form.CandidateName],
      ["Position",form.Position],
      ["Mobile",form.Mobile],
      ["Alternate Mobile",form.AlternateMobile],
      ["Permanent Address",form.PermanentAddress],
      ["Current Address",form.CurrentAddress],
      ["Email",form.Email],
      ["DOB",form.DOB],
      ["Gender",form.Gender],
      ["Blood Group",form.BloodGroup],
      ["Joining Date",form.JoiningDate],
      ["Department",form.Department],
      ["Designation",form.Designation],
      ["Salary",form.Salary],
      ["Aadhaar No",form.AadhaarNo],
      ["PAN No",form.PanNo],
      ["Bank Name",form.BankName],
      ["Bank Account No",form.BankAccountNo],
      ["IFSC",form.IFSC],
      ["First Salary Finalized",form.FirstSalary],
      ["Next Increment Date",form.NextIncrement],
      ["Previous Employer",form.PreviousCompany]
    ],

    theme:"grid",

    headStyles:{
      fillColor:[37,99,235],
      textColor:255
    }

  });

  // Save LAST
  doc.save(`${employeeId}_${form.CandidateName}.pdf`);

}