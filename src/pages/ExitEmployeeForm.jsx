import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import "./ExitEmployeeForm.css";

const GET_API =
"https://script.google.com/macros/s/AKfycbzp9jjuDv3H_T85SNi75ZJlLjKDlMB2NFlMaxZTVCG-C5VRDuM6OWd_KLwRatBWlmPzRA/exec";

const POST_API =
"https://script.google.com/macros/s/AKfycbxKo9AOgllSB-14y93FY6MG3NHBRZsYP6EvlmNB19c9MW4j8ohTFGt3U9EHxiqFg1rT/exec";

export default function ExitEmployeeForm(){

const { id } = useParams();

const [saving,setSaving]=useState(false);

const [form,setForm]=useState({

EmployeeID:"",
EmployeeName:"",
Department:"",
Designation:"",
ExitDate:"",
LastWorkingDate:"",
Reason:""

});

useEffect(()=>{

fetch(GET_API)

.then(res=>res.json())

.then(data=>{

const emp=data.find(e=>e.EmployeeID===id);

if(emp){

setForm({

EmployeeID:emp.EmployeeID,

EmployeeName:emp.Name,

Department:emp.Department,

// Designation:emp.Designation,

ExitDate:"",

LastWorkingDate:"",

Reason:""

});

}

});

},[id]);

const handleChange=(e)=>{

setForm({

...form,

[e.target.name]:e.target.value

});

};

const handleSubmit=async(e)=>{

e.preventDefault();

setSaving(true);

try{

const res=await fetch(POST_API,{

method:"POST",

body:JSON.stringify(form)

});

const data=await res.json();

if(data.success){

alert("Employee Exit Saved Successfully");

}

}catch(err){

alert("Failed");

}

setSaving(false);

};

return(

<div className="exit-page">

<div className="exit-card">

<h1>Exit Employee</h1>

<p>Fill employee exit details.</p>

<form onSubmit={handleSubmit}>

<div className="form-grid">

<div>

<label>Employee ID</label>

<input

type="text"

value={form.EmployeeID}

readOnly

/>

</div>

<div>

<label>Employee Name</label>

<input

type="text"

value={form.EmployeeName}

readOnly

/>

</div>

<div>

<label>Department</label>

<input

type="text"

value={form.Department}

readOnly

/>

</div>

{/* <div>

<label>Designation</label>

<input

type="text"

value={form.Designation}

readOnly

/>

</div> */}

<div>

<label>Exit Date *</label>

<input

type="date"

name="ExitDate"

value={form.ExitDate}

onChange={handleChange}

required

/>

</div>

<div>

<label>Last Working Date *</label>

<input

type="date"

name="LastWorkingDate"

value={form.LastWorkingDate}

onChange={handleChange}

required

/>

</div>

<div className="full-width">

<label>Reason of Exit *</label>

<textarea

rows="5"

name="Reason"

value={form.Reason}

onChange={handleChange}

required

/>

</div>

</div>

<div className="button-row">

<button

type="submit"

className={`save-btn ${saving?"saving":""}`}

disabled={saving}

>

{saving?"Saving...":"Submit Exit"}

</button>

</div>

</form>

</div>

</div>

);

}