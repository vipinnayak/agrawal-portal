import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./ClientAction.css";

const API =
  "https://script.google.com/macros/s/AKfycbxOIhrMTyaBdN_UnWiSj12gMeiaded7CHI_ONFgxlSDgz1zCbu2V8tnbpUmdvTIYv5EPw/exec";

export default function ClientAction() {

  const navigate = useNavigate();
  const location = useLocation();

  // Works with both state:item and state:{client:item}
  const client = location.state?.client || location.state;

  const [action, setAction] = useState("");

  if (!client) {
    return (
      <div className="action-page">
        <div className="action-card">
          <h2>No Client Selected</h2>

          <button
            className="cancel-btn"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>

        </div>
      </div>
    );
  }

  const submit = async (e) => {

  e.preventDefault();

  if (!action) {
    alert("Select Action");
    return;
  }

  try {

    const response = await fetch(API,{
      method:"POST",
      body:JSON.stringify({
        ClientID:client.ClientID,
        CompanyName:client.CompanyName,
        GroupName:client.GroupName,
        Action:action
      })
    });

    const text = await response.text();

    console.log(text);

    alert(text);

  } catch(err){

    console.error(err);

    alert(err.toString());

  }

};

  return (

    <div className="action-page">

      <div className="action-card">

        <h1>Client Action</h1>

        <form onSubmit={submit}>

          <div className="form-grid">

            <div className="form-group">
              <label>Client ID</label>
              <input
                type="text"
                value={client.ClientID || ""}
                readOnly
              />
            </div>

            <div className="form-group">
              <label>Company</label>
              <input
                type="text"
                value={client.CompanyName || ""}
                readOnly
              />
            </div>

            <div className="form-group">
              <label>Group</label>
              <input
                type="text"
                value={client.GroupName || ""}
                readOnly
              />
            </div>

            <div className="form-group full-width">

              <label>Action</label>

              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="">Select Action</option>
                <option value="Delete Client">Delete Client</option>
                <option value="Reject Approval">Reject Approval</option>
              </select>

            </div>

          </div>

          <div className="button-row">

            <button
              type="button"
              className="cancel-btn"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="submit-btn"
            >
              Submit
            </button>

          </div>

        </form>

      </div>

    </div>

  );

}