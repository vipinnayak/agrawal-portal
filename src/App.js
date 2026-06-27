import React from "react";

import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Login from "./pages/Login";
import MIS1 from "./pages/MIS1";
import LeaveForm from "./pages/LeaveForm";
import PendingApprovals from "./pages/PendingApprovals";
import AdminMD from "./pages/AdminMD";
import PendingApprovalsAdmin from "./pages/PendingApprovalsAdmin";
import DailyWorking from "./pages/DailyWorking";
import DailyWorkingForm from "./pages/DailyWorkingForm";
import NareshPrajapati from "./pages/NareshPrajapati";
import CAHARSHMITTAL from "./pages/CAHARSHMITTAL";
import DailyWorkingNaresh from "./pages/DailyWorkingNaresh";
import DailyAttendance from "./pages/DailyAttendance";
import AttendanceForm from "./pages/AttendanceForm";
import DelegationDashboard from "./pages/DelegationDashboard";
import DelegationForm from "./pages/DelegationForm";
import DailyWorkingHarshMittal from "./pages/DailyWorkingHarshMittal";
import CAHARSHSHARMA from "./pages/CAHARSHSHARMA";
import DailyWorkingHarshSharma from "./pages/DailyWorkingHarshSharma";
import InternalAuditFMS from "./pages/InternalAuditFMS";
import InternalAuditForm from "./pages/InternalAuditForm";
import InternalAuditDetails from "./pages/InternalAuditDetails";
import CAKANHA from "./pages/CAKANHA";
import DailyWorkingKanha from "./pages/DailyWorkingKanha";
import CAPANKAJ from "./pages/CAPANKAJ";
import DailyWorkingPankaj from "./pages/DailyWorkingPankaj";
import CADRISHTI from "./pages/CADRISHTI";
import DailyWorkingDrishti from "./pages/DailyWorkingDrishti";
import CACHANDAN from "./pages/CACHANDAN";
import DailyWorkingChandan from "./pages/DailyWorkingChandan";
import CAPRATIBHA from "./pages/CAPRATIBHA";
import DailyWorkingPratibha from "./pages/DailyWorkingPratibha";
import CAVIKAS from "./pages/CAVIKAS";
import DailyWorkingVikas from "./pages/DailyWorkingVikas";
import CAVEDANT from "./pages/CAVEDANT";
import DailyWorkingVedant from "./pages/DailyWorkingVedant";
import CAPRIYA from "./pages/CAPRIYA";
import DailyWorkingPriya from "./pages/DailyWorkingPriya";
import CAANKIT from "./pages/CAANKIT";
import DailyWorkingAnkit from "./pages/DailyWorkingAnkit";
import CAMUKUL from "./pages/CAMUKUL";
import DailyWorkingMukul from "./pages/DailyWorkingMukul";
import CARUPESH from "./pages/CARUPESH";
import DailyWorkingRupesh from "./pages/DailyWorkingRupesh";
import VipinNayak from "./pages/VipinNayak";
import DailyWorkingVipin from "./pages/DailyWorkingVipin";
import Rajni from "./pages/Rajni";
import YashJairaj from "./pages/YashJairaj";
import Yogita from "./pages/Yogita";
import Supriya from "./pages/Supriya";
import Pranjali from "./pages/Pranjali";
import Bhavika from "./pages/Bhavika";
import Babitahr from "./pages/Babitahr";
import Sarikahr from "./pages/Sarikahr";
import Meenu from "./pages/Meenu";
import Amit from "./pages/Amit";
import Vaishali from "./pages/Vaishali";
import Nayanpreet from "./pages/Nayanpreet";
import Vicky from "./pages/Vicky";
import Vimal from "./pages/Vimal";
import Chandrabhusan from "./pages/Chandrabhusan";
import Tushar from "./pages/Tushar";
import Lucky from "./pages/Lucky";
import Khushboo from "./pages/Khushboo";
import Reports from "./pages/Reports";
import TRDewangan from "./pages/TRDewangan";
import KhemlalSahu from "./pages/KhemlalSahu";
import Jitendra from "./pages/Jitendra";
import RohitVibhar from "./pages/RohitVibhar";
import ShubhamChoudhary from "./pages/ShubhamChoudhary";
import NeerajVerma from "./pages/NeerajVerma";
import SurajSanyashi from "./pages/SurajSanyashi";
import KundanYadav from "./pages/KundanYadav";
import AkashYadav from "./pages/AkashYadav";
import VikasSingh from "./pages/VikasSingh";
import FuleshDas from "./pages/FuleshDas";
import GauriSharma from "./pages/GauriSharma";
import KisanYadav from "./pages/KisanYadav";
import DayaluDewangan from "./pages/DayaluDewangan";
import JituTati from "./pages/JituTati";
import NitishShende from "./pages/NitishShende";


function App() {

  return (

    <BrowserRouter>

      <Routes>

        {/* LOGIN */}

        <Route
          path="/"
          element={<Login />}
        />
        <Route
          path="/trdewangan"
          element={<TRDewangan/>}
        />
        <Route
          path="/khemlalsahu"
          element={<KhemlalSahu/>}
        />
        <Route
          path="/jitendra"
          element={<Jitendra/>}
        />
        <Route
          path="/rohitvibhar"
          element={<RohitVibhar/>}
        />
        <Route
          path="/shubham"
          element={<ShubhamChoudhary/>}
        />
        <Route
          path="/neeraj"
          element={<NeerajVerma/>}
        />
        <Route
          path="/suraj"
          element={<SurajSanyashi/>}
        />
        <Route
          path="/kundan"
          element={<KundanYadav/>}
        />
        <Route
          path="/akash"
          element={<AkashYadav/>}
        />
        <Route
          path="/vikas"
          element={<VikasSingh/>}
        />
        <Route
          path="/fulesh"
          element={<FuleshDas/>}
        />
        <Route
          path="/gauri"
          element={<GauriSharma/>}
        />
        <Route
          path="/kishan"
          element={<KisanYadav/>}
        />
        <Route
          path="/dayalu"
          element={<DayaluDewangan/>}
        />
        <Route
          path="/jeetu"
          element={<JituTati/>}
        />
        <Route
          path="/nitish"
          element={<NitishShende/>}
        />

        {/* MIS 1 */}
        <Route
          path="/yash"
          element={<YashJairaj />}
        />
        <Route
          path="/khushboo"
          element={<Khushboo/>}
        />
         <Route
          path="/reports"
          element={<Reports/>}
        />
         <Route
          path="/amit"
          element={<Amit/>}
        />
         <Route
          path="/vaishali"
          element={<Vaishali/>}
        />
         <Route
          path="/nayanpreet"
          element={<Nayanpreet/>}
        />
         <Route
          path="/vicky"
          element={<Vicky/>}
        />
         <Route
          path="/vimal"
          element={<Vimal/>}
        />
         <Route
          path="/chandrabhusan"
          element={<Chandrabhusan/>}
        />
         <Route
          path="/tushar"
          element={<Tushar/>}
        />
         <Route
          path="/lucky"
          element={<Lucky/>}
        />

        <Route
          path="/meenu"
          element={<Meenu />}
        />
        <Route
          path="/pranjali"
          element={<Pranjali />}
        />
        <Route
          path="/yogita"
          element={<Yogita />}
        />
        <Route
          path="/bhavika"
          element={<Bhavika />}
        />
        <Route
          path="/babita"
          element={<Babitahr />}
        />
        <Route
          path="/sarika"
          element={<Sarikahr />}
        />
        <Route
          path="/supriya"
          element={<Supriya />}
        />
        <Route
          path="/rajni"
          element={<Rajni />}
        />
        <Route
          path="/mis1"
          element={<MIS1 />}
        />

        {/* ADMIN MD */}

        <Route
          path="/admin-md"
          element={<AdminMD />}
        />

        {/* LEAVE FORM */}

        <Route
          path="/leave-form"
          element={<LeaveForm />}
        />

        {/* MIS 1 PENDING APPROVALS */}

        <Route
          path="/pending-approvals"
          element={<PendingApprovals />}
        />

        {/* ADMIN PENDING APPROVALS */}

        <Route
          path="/pending-approvals-admin"
          element={<PendingApprovalsAdmin />}
        />

        {/* DAILY WORKING */}

        <Route
          path="/daily-working"
          element={<DailyWorking />}
        />

        {/* DAILY WORKING FORM */}

        <Route
          path="/daily-working-form"
          element={<DailyWorkingForm />}
        />

        {/* NARESH PRAJAPATI */}

        <Route
          path="/naresh-prajapati"
          element={<NareshPrajapati />}
        />
        <Route
          path="/ca-harsh-mittal"
          element={<CAHARSHMITTAL />}
        />
        <Route
          path="/ca-harsh-sharma"
          element={<CAHARSHSHARMA />}
        />
        <Route
          path="/ca-priya"
          element={<CAPRIYA />}
        />
        <Route
          path="/ca-vedant"
          element={<CAVEDANT />}
        />
        <Route
          path="/ca-ankit"
          element={<CAANKIT />}
        />
        <Route
          path="/ca-rupesh"
          element={<CARUPESH />}
        />
        <Route
          path="/ca-mukul"
          element={<CAMUKUL />}
        />
         <Route
          path="/ca-kanha"
          element={<CAKANHA />}
        />
        <Route
          path="/ca-pankaj"
          element={<CAPANKAJ />}
        />
        <Route
          path="/ca-pankaj"
          element={<CAVIKAS />}
        />
        <Route
          path="/ca-pratibha"
          element={<CAPRATIBHA />}
        />
        <Route
          path="/ca-chandan"
          element={<CACHANDAN />}
        />
         <Route
          path="/ca-drishti"
          element={<CADRISHTI />}
        />
        <Route
          path="/vipin"
          element={<VipinNayak />}
        />
  <Route
          path="/DelegationDashboard"
          element={<DelegationDashboard />}
        />
        {/* DAILY WORKING NARESH */}

        <Route
          path="/daily-working-vipin"
          element={<DailyWorkingVipin />}
        />
        <Route
          path="/daily-working-naresh"
          element={<DailyWorkingNaresh />}
        />
        <Route
          path="/daily-working-pratibha"
          element={<DailyWorkingPratibha />}
        />
         <Route
          path="/daily-working-harsh-mittal"
          element={<DailyWorkingHarshMittal />}
        />
        <Route
          path="/daily-working-ankit"
          element={<DailyWorkingAnkit />}
        />
        <Route
          path="/daily-working-rupesh"
          element={<DailyWorkingRupesh />}
        />
         <Route
          path="/daily-working-mukul"
          element={<DailyWorkingMukul />}
        />
        <Route
          path="/daily-working-vedant"
          element={<DailyWorkingVedant />}
        />
        <Route
          path="/daily-working-priya"
          element={<DailyWorkingPriya />}
        />
        <Route
          path="/daily-working-Vikas"
          element={<DailyWorkingVikas />}
        />
        <Route
          path="/daily-working-harsh-sharma"
          element={<DailyWorkingHarshSharma />}
        />
        <Route
          path="/daily-working-Kanha"
          element={<DailyWorkingKanha />}
        />
         <Route
          path="/daily-working-chandan"
          element={<DailyWorkingChandan />}
        />
        <Route
          path="/daily-working-Drishti"
          element={<DailyWorkingDrishti />}
        />
        <Route
          path="/daily-working-pankaj"
          element={<DailyWorkingPankaj />}
        />
        <Route
  path="/internalauditform"
  element={<InternalAuditForm />}
/>
  <Route
 path="/internalauditdetails"
 element={<InternalAuditDetails/>}
/>
 <Route
  path="/internal-audit-fms"
  element={<InternalAuditFMS />}
/>

<Route
  path="/daily-attendance"
  element={<DailyAttendance />}
/>
<Route
  path="/attendance-form"
  element={<AttendanceForm />}
/>
<Route
  path="/delegation-form"
  element={<DelegationForm />}
/>
      </Routes>

    </BrowserRouter>

  );

}

export default App;