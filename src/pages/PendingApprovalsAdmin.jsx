import React, { useEffect, useState } from "react";

import "./PendingApprovalsAdmin.css";

function PendingApprovalsAdmin() {

  const [data, setData] = useState([]);

  const [showRejectBox, setShowRejectBox] = useState(false);

  const [rejectReason, setRejectReason] = useState("");

  const [selectedCode, setSelectedCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionStatus, setActionStatus] = useState({});

  useEffect(() => {

    fetch(
      "https://script.google.com/macros/s/AKfycbxPNEam1oR6hiQKrse9f6pJWaAkkvrkAPVohNiuUEkvMh414tZPbvjL154KpkWwuUfbaA/exec"
    )
      .then((res) => res.json())
      .then((result) => {

        setData(result);

      })
      .catch((error) => {

        console.log(error);

      });

  }, []);

  // DATE FORMAT

  const formatDate = (value) => {

    if (!value) return "";

    return new Date(value)
      .toLocaleDateString("en-GB");

  };

  // APPROVE FUNCTION

 const handleApprove = async (uniqueCode) => {

  if(actionStatus[uniqueCode]) return;

  setActionStatus((prev) => ({
    ...prev,
    [uniqueCode]: "loading",
  }));

  try{

    await fetch(
      "https://script.google.com/macros/s/AKfycbwwmFrvMdHiGMrGQsf5fzbajVR6nL1LJhXDXf8WkDir6bAcyZyS4OxYh2pac0grzhZc/exec",
      {
        method: "POST",

        body: JSON.stringify({

          uniqueCode: uniqueCode,

          status: "APPROVED",

          reason: "",

          actionBy: "ADMIN(MD)",

        }),

      }
    );

    setActionStatus((prev) => ({
      ...prev,
      [uniqueCode]: "approved",
    }));

  }

  catch(error){

    console.log(error);
    alert("Leave Rejected");

    setActionStatus((prev) => ({
  ...prev,
  [selectedCode]: "rejected",
}));

  }

};
  // OPEN REJECT POPUP

  const openRejectPopup = (uniqueCode) => {

    setSelectedCode(uniqueCode);

    setShowRejectBox(true);

  };

  // SUBMIT REJECT

  const submitReject = async () => {

  if(rejectReason === ""){

    alert("Enter Reject Reason");

    return;

  }

  setIsSubmitting(true);

  try{

    await fetch(
      "https://script.google.com/macros/s/AKfycbwwmFrvMdHiGMrGQsf5fzbajVR6nL1LJhXDXf8WkDir6bAcyZyS4OxYh2pac0grzhZc/exec",
      {
        method:"POST",

        body:JSON.stringify({

          uniqueCode:selectedCode,

          status:"REJECTED",

          reason:rejectReason,

          actionBy:"ADMIN(MD)",

        }),
      }
    );

    alert("Leave Rejected");

    setShowRejectBox(false);

    setRejectReason("");

  }

  catch(error){

    console.log(error);

    alert("Something Went Wrong");

  }

  finally{

    setIsSubmitting(false);

  }

};

  return (

    <div className="page">

      {/* HEADER */}

      <div className="header">

        <h1 className="heading">
          Pending Approvals
        </h1>

        <p className="subHeading">
          Agrawal Jain & Co.
        </p>

      </div>

      {/* TABLE */}

      <div className="tableWrapper">

        <table className="table">

          <thead>

            <tr>

              <th className="th">
                UNIQUE CODE
              </th>

              <th className="th">
                TimeStamp
              </th>

              <th className="th">
                Employee Name
              </th>

              <th className="th">
                Requested Leave Date
              </th>

              <th className="th">
                Leave Till Date
              </th>

              <th className="th">
                Expected Rejoin Date
              </th>

              <th className="th">
                Reason For Leave
              </th>

              <th className="th">
                ACTION
              </th>

            </tr>

          </thead>

          <tbody>

            {data.length > 0 ? (

              data.map((item, index) => (

                <tr key={index}>

                  <td className="td">
                    {item.uniqueCode}
                  </td>

                  <td className="td">
                    {formatDate(item.timestamp)}
                  </td>

                  <td className="td">
                    {item.employeeName}
                  </td>

                  <td className="td">
                    {formatDate(item.requestedLeave)}
                  </td>

                  <td className="td">
                    {formatDate(item.leaveTillDate)}
                  </td>

                  <td className="td">
                    {formatDate(item.expectedRejoin)}
                  </td>

                  <td className="td">
                    {item.reason}
                  </td>

                  <td className="td">

                    {actionStatus[item.uniqueCode] === "approved" ? (

  <div className="approvedStatus">
    ✅ Approved
  </div>

) : actionStatus[item.uniqueCode] === "rejected" ? (

  <div className="rejectedStatus">
    ❌ Rejected
  </div>

) : actionStatus[item.uniqueCode] === "loading" ? (

  <div className="loadingStatus">
    Saving...
  </div>

) : (

  <>

    <button
      className="approveBtn"
      onClick={() =>
        handleApprove(
          item.uniqueCode
        )
      }
    >
      ✅
    </button>

    <button
      className="rejectBtn"
      onClick={() =>
        openRejectPopup(
          item.uniqueCode
        )
      }
    >
      ❌
    </button>

  </>

)}

                  </td>

                </tr>

              ))

            ) : (

              <tr>

                <td
                  colSpan="8"
                  className="noData"
                >
                  Loading...
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

      {/* REJECT POPUP */}

      {showRejectBox && (

        <div className="popupOverlay">

          <div className="popupBox">

            <h2 className="popupTitle">
              Reject Leave
            </h2>

            <p className="popupText">
              Enter Reject Reason
            </p>

            <textarea
              className="textarea"
              value={rejectReason}
              onChange={(e)=>
                setRejectReason(e.target.value)
              }
              placeholder="Enter reason..."
            />

            <div className="popupButtons">

              <button
                className="cancelBtn"
                onClick={() => {

                  setShowRejectBox(false);

                  setRejectReason("");

                }}
              >
                Cancel
              </button>

              <button
  className="submitBtn"
  onClick={submitReject}
  disabled={isSubmitting}
>
  {isSubmitting ? "Submitting..." : "Submit"}
</button>

            </div>

          </div>

        </div>

      )}

    </div>

  );
}

export default PendingApprovalsAdmin;