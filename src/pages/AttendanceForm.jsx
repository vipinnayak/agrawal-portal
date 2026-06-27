import React, { useEffect, useState } from "react";
import "./AttendanceForm.css";

function AttendanceForm() {

  const [location, setLocation] =
    useState("Fetching Location...");

  const [mapUrl, setMapUrl] =
    useState("");

  const [employeeList, setEmployeeList] =
    useState([]);

  const [loading, setLoading] =
    useState(false);
    const getAttendanceType = () => {

  const hour = new Date().getHours();

  return hour >= 16
    ? "OUT"
    : "IN";

};

 const [formData, setFormData] = useState({

  date: "",
  employeeName: "",
  time: "",
  attendanceType: "IN",
  clientPlace: ""

});

  // AUTO DATE + TIME

  useEffect(() => {

    const now = new Date();

    const date =
      now.toLocaleDateString("en-GB");

    const time =
      now.toLocaleTimeString([], {

        hour: "2-digit",
        minute: "2-digit"

      });

   setFormData({

  date,
  employeeName: "",
  time,
  attendanceType:
    getAttendanceType(),
  clientPlace: ""

});

  }, []);

  // FETCH EMPLOYEE NAMES

  useEffect(() => {

    fetch(
      "https://script.google.com/macros/s/AKfycbx_prCPCYi3OfDUvXX5dbW319gAbqaK9NwVuGmjzk7E_1hu6pk4PZvBED0acUZ7NvvXOg/exec"
    )

      .then((res) => res.json())

      .then((data) => {

        console.log(
          "Dropdown Data:",
          data
        );

        if (
          Array.isArray(data)
        ) {

          setEmployeeList(data);

        } else if (
          data.employeeNames
        ) {

          setEmployeeList(
            data.employeeNames
          );

        }

      })

      .catch((err) => {

        console.log(err);

      });

  }, []);

  // FETCH DEVICE LOCATION + MAP

  useEffect(() => {

    if (navigator.geolocation) {

      navigator.geolocation.getCurrentPosition(

        async (position) => {

          const lat =
            position.coords.latitude;

          const lng =
            position.coords.longitude;

          // MAP URL

          setMapUrl(
            `https://www.google.com/maps?q=${lat},${lng}&z=18&output=embed`
          );

          try {

            const response =
              await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
              );

            const data =
              await response.json();

            console.log(data);

            const house =
              data.address.house_number || "";

            const road =
              data.address.road || "";

            const suburb =
              data.address.suburb ||
              data.address.neighbourhood ||
              data.address.residential ||
              "";

            const area =
              data.address.city_district ||
              data.address.county ||
              "";

            const city =
              data.address.city ||
              data.address.town ||
              data.address.village ||
              "";

            const state =
              data.address.state || "";

            const finalLocation = `

${house ? house + ", " : ""}
${road ? road + ", " : ""}
${suburb ? suburb + ", " : ""}
${area ? area + ", " : ""}
${city ? city + ", " : ""}
${state}

            `;

            setLocation(
              finalLocation
                .replace(/\n/g, "")
                .trim()
            );

          } catch (error) {

            console.log(error);

            setLocation(
              "Location Not Found"
            );

          }

        },

        () => {

          setLocation(
            "Location Permission Denied"
          );

        },

        {

          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0

        }

      );

    }

  }, []);

  // HANDLE INPUT

  const handleChange = (e) => {

    setFormData({

      ...formData,

      [e.target.name]:
        e.target.value

    });

  };

  // SUBMIT FORM

  const handleSubmit = async (e) => {

    e.preventDefault();

    setLoading(true);

    const finalData = {

      ...formData,

      location

    };

    try {

      const response =
       await fetch(
  "https://script.google.com/macros/s/AKfycbzyUfuwt9rjd7yAR4_2moI9dl0n13MOy08OAOq_Te_B7SMOxJx29mk_PXthY7vIXR56/exec",
  {
    method: "POST",
    body: JSON.stringify(finalData)
  }
);

      const result =
        await response.json();

      console.log(result);

      alert(
        "Attendance Marked Successfully"
      );

    } catch (error) {

      console.log(error);

      alert(
        "Error Submitting Attendance"
      );

    }

    setLoading(false);

  };

  return (

    <div className="attendance-form-page">

      <div className="glass-form">

        <div className="form-header">

          <h1>
            Mark Attendance
          </h1>

          <p>
            Agrawal Jain & Co.
          </p>

        </div>

        <form onSubmit={handleSubmit}>

          {/* DATE */}

          <div className="input-group">

            <label>
              Date
            </label>

            <input
              type="text"
              name="date"
              value={formData.date}
              readOnly
            />

          </div>

          {/* EMPLOYEE */}

          <div className="input-group">

            <label>
              Employee Name
            </label>

            <select
              name="employeeName"
              value={formData.employeeName}
              onChange={handleChange}
              required
            >

              <option value="">
                Select Employee
              </option>

              {employeeList.map(
                (employee, index) => (

                  <option
                    key={index}
                    value={employee}
                  >
                    {employee}
                  </option>

                )
              )}

            </select>

          </div>

          {/* CLIENT PLACE */}

          <div className="input-group">

            <label>
              If In Client Place
            </label>

            <input
              type="text"
              name="clientPlace"
              placeholder="Enter Client Place Name"
              value={formData.clientPlace || ""}
              onChange={handleChange}
            />

          </div>

          {/* TIME */}

          <div className="input-group">

            <label>
              Time
            </label>

            <input
              type="time"
              name="time"
              value={formData.time}
              onChange={handleChange}
            />
            </div>

{/* ATTENDANCE TYPE */}

<div className="input-group">
  <label>Attendance Type</label>

  <div className="attendance-type">

    <button
      type="button"
      className={formData.attendanceType === "IN" ? "active" : ""}
      onClick={() =>
        setFormData({
          ...formData,
          attendanceType: "IN",
        })
      }
    >
      IN
    </button>

    <button
      type="button"
      className={formData.attendanceType === "OUT" ? "active" : ""}
      onClick={() =>
        setFormData({
          ...formData,
          attendanceType: "OUT",
        })
      }
    >
      OUT
    </button>

  </div>
</div>
<div className="input-group">

          </div>

          {/* LOCATION */}

          <div className="input-group">

            <label>
              Device Location
            </label>

            <textarea
              value={location}
              readOnly
            />

          </div>

          {/* GOOGLE MAP */}

          <div className="map-container">

            <iframe
              title="Google Map"
              src={mapUrl}
              width="100%"
              height="320"
              style={{
                border: 0,
                borderRadius: "24px"
              }}
              allowFullScreen=""
              loading="lazy"
            ></iframe>

          </div>

          {/* SUBMIT BUTTON */}

          <button
            type="submit"
            className={`submit-btn ${loading ? "loading-btn" : ""}`}
            disabled={loading}
          >

            {
              loading
                ? "Submitting..."
                : "Mark Attendance"
            }

          </button>

        </form>

      </div>

    </div>

  );

}

export default AttendanceForm;