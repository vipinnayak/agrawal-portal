import { useState } from "react";
import "./AddEmployeeForm.css";
import generateEmployeePDF from "../utils/generateEmployeePDF";

const API =
"https://script.google.com/macros/s/AKfycbzMc2ZIfKwYMDo5UsiRtMVOa30ZWJ35I2TIf5vlr7D_HBUrGOpxbaUHwIVAIooCC0eB/exec";

export default function AddEmployeeForm() {
const [saving, setSaving] = useState(false);
const [declaration, setDeclaration] = useState(false);
const [form,setForm]=useState({

CandidateName:"",
Position:"",
Mobile:"",
AlternateMobile:"",
PermanentAddress:"",
CurrentAddress:"",
Email:"",
DOB:"",
Gender:"",
BloodGroup:"",
JoiningDate:"",
Department:"",
Designation:"",
Salary:"",
AadhaarNo:"",
AadhaarPhoto:"",
PanNo:"",
PanPhoto:"",
BankName:"",
BankAccountNo:"",
IFSC:"",
PassbookPhoto:"",
FirstSalary:"",
NextIncrement:"",
PassportPhoto:"",
PreviousCompany:""

});

const handleChange=(e)=>{

const {name,value}=e.target;

setForm({

...form,

[name]:value

});

};
function fileToBase64(file) {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);

    reader.onerror = reject;

    reader.readAsDataURL(file);

  });

}

const handleSubmit = async (e) => {

  e.preventDefault();
  if (!declaration) {

  alert("Please confirm that all details entered are correct.");

  return;

}

  if (saving) return;

  setSaving(true);

  try {

    let passportPhoto = "";

    if (form.PassportPhoto) {
      passportPhoto = await fileToBase64(form.PassportPhoto);
    }

    console.log(form.PassportPhoto);
    console.log(passportPhoto);

    const payload = {
      ...form,
      PassportPhoto: "" // Don't send image to Google Sheet
    };

    const response = await fetch(API, {
      method: "POST",
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.success) {

      generateEmployeePDF(
        {
          ...form,
          PassportPhoto: passportPhoto
        },
        data.employeeId
      );

      alert("Employee Saved Successfully");

    } else {

      alert("Save Failed");

    }

  } catch (err) {

    console.log(err);
    alert("Submission Failed");

  }

  setSaving(false);

};

return(

<div className="employee-form-page">

<div className="employee-form-card">

<h1>Add Employee</h1>

<p>Fill all employee details.</p>

<form onSubmit={handleSubmit}>

{/* =========================
SECTION 1
========================= */}

<div className="section-title">
Basic Information
</div>

<div className="form-grid">

<div>

<label>Candidate Name *</label>

<input
type="text"
name="CandidateName"
value={form.CandidateName}
onChange={handleChange}
required
/>

</div>
<div>

<label>Passport Size Photo (Max 2 MB)</label>

<input
  type="file"
  accept="image/*"
  onChange={(e) => {

    const file = e.target.files[0];

    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {

      alert("Maximum size is 2 MB");

      e.target.value = "";

      return;

    }

    setForm({

      ...form,

      PassportPhoto: file

    });

  }}
/>

</div>

<div>

<label>Position *</label>

<input
type="text"
name="Position"
value={form.Position}
onChange={handleChange}
required
/>

</div>

<div>

<label>Mobile *</label>

<input
type="number"
name="Mobile"
value={form.Mobile}
onChange={handleChange}
required
/>

</div>

<div>

<label>Alternate Mobile</label>

<input
type="number"
name="AlternateMobile"
value={form.AlternateMobile}
onChange={handleChange}
/>

</div>

<div className="full-width">

<label>Permanent Address *</label>

<textarea
rows="3"
name="PermanentAddress"
value={form.PermanentAddress}
onChange={handleChange}
required
/>

</div>

<div className="same-address">

<label>

<input
type="checkbox"
onChange={(e)=>{

if(e.target.checked){

setForm({

...form,

CurrentAddress:form.PermanentAddress

});

}else{

setForm({

...form,

CurrentAddress:""

});

}

}}
/>

Current Address is same as Permanent Address

</label>

</div>

<div className="full-width">

<label>Current Address *</label>

<textarea
rows="3"
name="CurrentAddress"
value={form.CurrentAddress}
onChange={handleChange}
required
/>

</div>

</div>

{/* =========================
SECTION 2
========================= */}

<div className="section-title">
Personal Details
</div>

<div className="form-grid">
    <div>

<label>Email *</label>

<input
type="email"
name="Email"
value={form.Email}
onChange={handleChange}
required
/>

</div>

<div>

<label>Date Of Birth *</label>

<input
type="date"
name="DOB"
value={form.DOB}
onChange={handleChange}
required
/>

</div>

<div>

<label>Gender *</label>

<select
name="Gender"
value={form.Gender}
onChange={handleChange}
required
>

<option value="">Select Gender</option>
<option value="Male">Male</option>
<option value="Female">Female</option>
<option value="Other">Other</option>

</select>

</div>

<div>

<label>Blood Group</label>

<input
type="text"
name="BloodGroup"
value={form.BloodGroup}
onChange={handleChange}
/>

</div>

<div>

<label>Joining Date *</label>

<input
type="date"
name="JoiningDate"
value={form.JoiningDate}
onChange={handleChange}
required
/>

</div>

<div>

<label>Department *</label>

<input
type="text"
name="Department"
value={form.Department}
onChange={handleChange}
required
/>

</div>

<div>

<label>Designation *</label>

<input
type="text"
name="Designation"
value={form.Designation}
onChange={handleChange}
required
/>

</div>

<div>

<label>Salary *</label>

<input
type="number"
name="Salary"
value={form.Salary}
onChange={handleChange}
required
/>

</div>

</div>

{/* =========================
SECTION 3
========================= */}

<div className="section-title">
KYC Details
</div>

<div className="form-grid">

<div>

<label>Aadhaar Card No *</label>

<input
type="text"
name="AadhaarNo"
value={form.AadhaarNo}
onChange={handleChange}
required
/>

</div>

<div>

<label>Aadhaar Photo (Max 2 MB)</label>

<input
type="file"
name="AadhaarPhoto"
accept="image/*,.pdf"
onChange={(e)=>{

const file=e.target.files[0];

if(file){

if(file.size>2*1024*1024){

alert("Aadhaar Photo must be less than 2 MB");

e.target.value="";

return;

}

setForm({

...form,

AadhaarPhoto:file

});

}

}}
/>

</div>

<div>

<label>PAN Photo (Max 2 MB)</label>

<input
type="file"
name="PanPhoto"
accept="image/*,.pdf"
onChange={(e)=>{

const file=e.target.files[0];

if(file){

if(file.size>2*1024*1024){

alert("PAN Photo must be less than 2 MB");

e.target.value="";

return;

}

setForm({

...form,

PanPhoto:file

});

}

}}
/>

</div>

</div>

{/* =========================
SECTION 4
========================= */}

<div className="section-title">
Bank Details
</div>

<div className="form-grid"><div>

<label>Bank Name *</label>

<input
type="text"
name="BankName"
value={form.BankName}
onChange={handleChange}
required
/>

</div>

<div>

<label>Bank Account No *</label>

<input
type="text"
name="BankAccountNo"
value={form.BankAccountNo}
onChange={handleChange}
required
/>

</div>

<div>

<label>IFSC Code *</label>

<input
type="text"
name="IFSC"
value={form.IFSC}
onChange={handleChange}
required
/>

</div>

<div>

<label>Passbook / Cancel Cheque Link</label>

<input
type="text"
name="PassbookPhoto"
value={form.PassbookPhoto}
onChange={handleChange}
/>

</div>

</div>

{/* =========================
SECTION 5
========================= */}

<div className="section-title">
Other Details
</div>

<div className="form-grid">

<div>

<label>First Salary Finalized *</label>

<input
type="text"
name="FirstSalary"
value={form.FirstSalary}
onChange={handleChange}
required
/>

</div>

<div>

<label>Next Increment Date *</label>

<input
type="date"
name="NextIncrement"
value={form.NextIncrement}
onChange={handleChange}
required
/>

</div>

<div>

<label>Previous Employer Name</label>

<input
type="text"
name="PreviousCompany"
value={form.PreviousCompany}
onChange={handleChange}
/>

</div>

</div>
<div className="declaration-box">

  <label>

    <input
      type="checkbox"
      checked={declaration}
      onChange={(e) => setDeclaration(e.target.checked)}
    />

    I hereby declare that all the information provided above is true, complete and correct. I understand that any false information may lead to rejection or disciplinary action.

  </label>

</div>
<div className="button-row">

<button
  type="submit"
  className={`save-btn ${saving ? "saving" : ""}`}
  disabled={saving}
>
  {saving ? (
    <>
      <span className="loader"></span>
      Saving...
    </>
  ) : (
    "Save Employee"
  )}
</button>

</div></form>

</div>

</div>

);

}