import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import MIS1 from "./pages/MIS1";
import LeaveForm from "./pages/LeaveForm";

function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route path="/" element={<Login />} />

        <Route path="/mis1" element={<MIS1 />} />
        <Route path="/leave-form" element={<LeaveForm />} />

      </Routes>

    </BrowserRouter>
  );
}

export default App;