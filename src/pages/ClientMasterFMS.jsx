import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ClientMasterFMS.css";

const API =
"https://script.google.com/macros/s/AKfycbwa3w45l2ruqW7G11pJk9uyEbkmHgHQ02LbVbyQXoLBLwhrCI3UogWnZPWPM_LpJoyy/exec";

export default function ClientMasterFMS() {

const navigate = useNavigate();

const [clients,setClients]=useState([]);

const [filtered,setFiltered]=useState([]);

const [search,setSearch]=useState("");

const [statusFilter,setStatusFilter]=useState("ALL");

useEffect(()=>{

fetch(API)

.then(res=>res.json())

.then(data=>{

setClients(data);

setFiltered(data);

})

.catch(err=>console.log(err));

},[]);

useEffect(()=>{

let data=[...clients];

if(search){

const value=search.toLowerCase();

data=data.filter(item=>

(item.ClientID||"").toLowerCase().includes(value)||

(item.CompanyName||"").toLowerCase().includes(value)||

(item.GroupName||"").toLowerCase().includes(value)||

(item.Owner||"").toLowerCase().includes(value)||

(item.Department||"").toLowerCase().includes(value)

);

}

if(statusFilter==="YES"){

data=data.filter(item=>item.Status==="YES");

}

else if(statusFilter==="NO"){

data=data.filter(item=>

item.Status==="NO"||

item.Status==="CANCELLED"

);

}

else if(statusFilter==="PENDING"){

data=data.filter(item=>

!item.Status

);

}

setFiltered(data);

},[clients,search,statusFilter]);

return(

<div className="fms-page">

<h1>Client Master FMS</h1>

<div className="top-bar">

<input

type="text"

placeholder="🔍 Search Client..."

value={search}

onChange={(e)=>setSearch(e.target.value)}

/>

<div className="top-actions">

<button

className="approval-btn"

onClick={()=>window.open(

"https://docs.google.com/forms/d/e/1FAIpQLSdvQNhl1vt3DUUqSW_NMzwLZYEO-1ohmas3AQ1sejYST7Kj3A/viewform",

"_blank"

)}

>

➕ Add Client For Approval

</button>

<select

value={statusFilter}

onChange={(e)=>setStatusFilter(e.target.value)}

>

<option value="ALL">

All Clients

</option>

<option value="YES">

🟢 Approved

</option>

<option value="PENDING">

🟡 Pending

</option>

<option value="NO">

🔴 Rejected

</option>

</select>

</div>

</div>

<table>

<thead>

<tr>

<th>Client ID</th>

<th>Company</th>

<th>Group</th>

<th>Department</th>

<th>Owner</th>

<th>Submitted On</th>

<th>Status</th>

<th>Reason</th>

<th>Action</th>

</tr>

</thead>

<tbody>

{filtered.length===0?(
<tr>

<td colSpan="9" className="no-data">

No Client Found

</td>

</tr>

):(

filtered.map((item,index)=>(

<tr key={index}>
    <td>{item.ClientID}</td>

<td>{item.CompanyName}</td>

<td>{item.GroupName}</td>

<td>{item.Department}</td>

<td>{item.Owner}</td>

<td>

{item.Timestamp
? new Date(item.Timestamp).toLocaleDateString("en-GB")
: "-"}

</td>

<td>

{item.Status==="YES" ? (

<span className="approved">

🟢 Approved

</span>

) : item.Status==="NO" || item.Status==="CANCELLED" ? (

<span className="rejected">

🔴 Rejected

</span>

) : (

<span className="pending">

🟡 Pending

</span>

)}

</td>

<td>

{item.Status==="YES"

? "Approved by HR"

: item.Status==="NO" || item.Status==="CANCELLED"

? "Cancelled / Rejected by HR"

: "Waiting for HR Approval"}

</td>

<td>

<td>
  <button
    className="action-btn"
    onClick={() =>
      navigate("/client-action", {
        state: {
          client: item,
        },
      })
    }
  >
    Action
  </button>
</td>

</td>

</tr>
              ))

            )

          }

        </tbody>

      </table>

    </div>

  );

}