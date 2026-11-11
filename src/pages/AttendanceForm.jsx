import React, { useEffect, useState, useRef, useCallback } from "react";
import "./AttendanceForm.css";

function AttendanceForm() {
  const [location, setLocation] = useState("Fetching Location...");
  const [mapUrl, setMapUrl] = useState("");
  const [coords, setCoords] = useState(null);
  const [accuracy, setAccuracy] = useState(null);

  const [employeeList, setEmployeeList] = useState([]);
  const [loading, setLoading] = useState(false);

  const watchIdRef = useRef(null);
  const timeoutIdRef = useRef(null);
  const bestPositionRef = useRef(null);

  const getAttendanceType = () => {
    const hour = new Date().getHours();
    return hour >= 16 ? "OUT" : "IN";
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
    const date = now.toLocaleDateString("en-GB");
    const time = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });

    setFormData((prev) => ({
      ...prev,
      date,
      time,
      attendanceType: getAttendanceType()
    }));
  }, []);

  // FETCH EMPLOYEE NAMES
  useEffect(() => {
    fetch(
      "https://script.google.com/macros/s/AKfycbx_prCPCYi3OfDUvXX5dbW319gAbqaK9NwVuGmjzk7E_1hu6pk4PZvBED0acUZ7NvvXOg/exec"
    )
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setEmployeeList(data);
        } else if (data.employeeNames) {
          setEmployeeList(data.employeeNames);
        }
      })
      .catch((err) => {
        console.log(err);
      });
  }, []);

  // REVERSE GEOCODING
  const reverseGeocode = async (lat, lng, acc) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            "Accept-Language": "en"
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Reverse geocode HTTP error ${response.status}`);
      }

      const data = await response.json();
      const addr = data.address || {};

      const poi =
        addr.office ||
        addr.building ||
        addr.amenity ||
        addr.shop ||
        addr.commercial ||
        addr.industrial ||
        addr.tourism ||
        "";

      const house = addr.house_number || addr.house_name || "";
      const road = addr.road || addr.street || addr.pedestrian || "";
      const locality =
        addr.neighbourhood ||
        addr.suburb ||
        addr.residential ||
        addr.subdistrict ||
        "";
      const area = addr.city_district || addr.county || "";
      const city =
        addr.city || addr.town || addr.village || addr.municipality || "";
      const state = addr.state || "";
      const postcode = addr.postcode ? addr.postcode : "";

      const parts = [
        poi,
        house,
        road,
        locality,
        area,
        city ? (postcode ? `${city} - ${postcode}` : city) : "",
        state
      ].filter(Boolean);

      let formattedAddress = parts.join(", ");

      if (parts.length < 2 && data.display_name) {
        formattedAddress = data.display_name;
      }

      if (!formattedAddress) {
        formattedAddress = `Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`;
      }

      const finalLocation = `${formattedAddress} [GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)} | ±${acc}m]`;
      setLocation(finalLocation);
    } catch (err) {
      console.warn("Reverse geocode fallback:", err);
      setLocation(`GPS Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)} (Accuracy: ±${acc}m)`);
    }
  };

  // APPLY POSITION UPDATE
  const applyPosition = useCallback((position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const acc = Math.round(position.coords.accuracy);

    setCoords({ lat, lng, accuracy: acc });
    setAccuracy(acc);

    setMapUrl(`https://www.google.com/maps?q=${lat},${lng}&z=18&output=embed`);
    reverseGeocode(lat, lng, acc);
  }, []);

  // AUTOMATIC BACKGROUND HIGH-PRECISION LOCATION ACQUISITION
  const fetchPreciseLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocation("Geolocation is not supported by your browser");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timeoutIdRef.current !== null) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    bestPositionRef.current = null;

    const onWatchSuccess = (position) => {
      const currentAcc = position.coords.accuracy;

      // Keep updating as more precise readings arrive
      if (
        !bestPositionRef.current ||
        currentAcc < bestPositionRef.current.coords.accuracy
      ) {
        bestPositionRef.current = position;
        applyPosition(position);
      }

      // High satellite precision lock (<= 15 meters) achieved
      if (currentAcc <= 15) {
        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
        if (timeoutIdRef.current !== null) {
          clearTimeout(timeoutIdRef.current);
          timeoutIdRef.current = null;
        }
        applyPosition(position);
      }
    };

    const onWatchError = (error) => {
      console.warn("Geolocation watch error:", error);
      if (!bestPositionRef.current) {
        if (error.code === error.PERMISSION_DENIED) {
          setLocation("Location Permission Denied");
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setLocation("Location Signal Unavailable");
        } else if (error.code === error.TIMEOUT) {
          setLocation("Location Request Timed Out");
        } else {
          setLocation("Unable to retrieve location");
        }
      }
    };

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(
        onWatchSuccess,
        onWatchError,
        options
      );
    } catch (e) {
      console.error(e);
    }

    // After 10s stop watching to preserve battery, retaining the best reading
    timeoutIdRef.current = setTimeout(() => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (bestPositionRef.current) {
        applyPosition(bestPositionRef.current);
      }
    }, 10000);
  }, [applyPosition]);

  // AUTOMATICALLY START LOCATION DETECTION ON FORM LOAD
  useEffect(() => {
    fetchPreciseLocation();

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (timeoutIdRef.current !== null) {
        clearTimeout(timeoutIdRef.current);
      }
    };
  }, [fetchPreciseLocation]);

  // HANDLE INPUT
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // SUBMIT FORM
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!coords && location === "Fetching Location...") {
      alert("Please wait a moment while device location is being detected...");
      return;
    }

    setLoading(true);

    const finalData = {
      ...formData,
      location,
      latitude: coords ? coords.lat : "",
      longitude: coords ? coords.lng : "",
      accuracy: accuracy ? `${accuracy}m` : ""
    };

    try {
      const response = await fetch(
        "https://script.google.com/macros/s/AKfycbzyUfuwt9rjd7yAR4_2moI9dl0n13MOy08OAOq_Te_B7SMOxJx29mk_PXthY7vIXR56/exec",
        {
          method: "POST",
          body: JSON.stringify(finalData)
        }
      );

      const result = await response.json();
      console.log(result);

      alert("Attendance Marked Successfully");
    } catch (error) {
      console.log(error);
      alert("Error Submitting Attendance");
    }

    setLoading(false);
  };

  return (
    <div className="attendance-form-page">
      <div className="glass-form">
        <div className="form-header">
          <h1>Mark Attendance</h1>
          <p>Agrawal Jain & Co.</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* DATE */}
          <div className="input-group">
            <label>Date</label>
            <input
              type="text"
              name="date"
              value={formData.date}
              readOnly
            />
          </div>

          {/* EMPLOYEE */}
          <div className="input-group">
            <label>Employee Name</label>
            <select
              name="employeeName"
              value={formData.employeeName}
              onChange={handleChange}
              required
            >
              <option value="">Select Employee</option>
              {employeeList.map((employee, index) => (
                <option key={index} value={employee}>
                  {employee}
                </option>
              ))}
            </select>
          </div>

          {/* CLIENT PLACE */}
          <div className="input-group">
            <label>If In Client Place</label>
            <input
              type="text"
              name="clientPlace"
              placeholder="Enter Client Place Name"
              value={
                formData.clientPlace || ""
              }
              onChange={handleChange}
            />
          </div>

          {/* TIME */}
          <div className="input-group">
            <label>Time</label>
            <input
              type="time"
              name="time"
              value={formData.time}
              min={getMinimumTime()}
              max={currentTime}
              onChange={handleChange}
              required
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
                    attendanceType: "IN"
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
                    attendanceType: "OUT"
                  })
                }
              >
                OUT
              </button>
            </div>
          </div>

          {/* DEVICE LOCATION */}
          <div className="input-group">
            <label>Device Location</label>
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
            className={`submit-btn ${
              loading
                ? "loading-btn"
                : ""
            }`}
            disabled={loading}
          >
            {loading ? "Submitting..." : "Mark Attendance"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AttendanceForm;