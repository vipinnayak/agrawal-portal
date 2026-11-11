import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Forms.css";

// Centralized configuration for all Google Form links.
// Replace the dummy URLs below with your actual form links.
export const FORM_LINKS = {
  // AJC FORMS
  clientMaster: "https://docs.google.com/forms/d/e/1FAIpQLSdNtCou38N2JCLeJmmUpTMS_f8UXjMkkB__l4Y9GqMbY-lvQA/viewform",
  priceComparison: "https://script.google.com/macros/s/AKfycbxhIE08SaokUL1k6lVeXi5SH68t1O10J4noeiVmf39DtOm93gkD2DrFHfntOrPMrZ5N-A/exec",
  borrowingProfile: "https://docs.google.com/forms/d/e/1FAIpQLSfzbJmDGWRM9j8DDhwJfWlMj9h06rRnhPhTdL4HrnDx0fnOOQ/viewform",
  pendingWork: "https://docs.google.com/forms/d/e/1FAIpQLSeIwDRXcnnTmiqL8ZnMHiVHnmiTwnYC8qZGpKDomk7heubukQ/viewform",
  enquiryCapture: "https://docs.google.com/forms/d/e/1FAIpQLScS5RbXGsfpNXXTHVKh0XJyYjOGy1edN0m9Hl8od8aGjVGtPQ/viewform",
  aiUsageMonthly: "https://docs.google.com/forms/d/e/1FAIpQLScR7azWjjS8kcZlrRw1BChBnzbdqwx5CWI2cHUcm4roqc3DjQ/viewform",
  newSystem: "https://docs.google.com/forms/d/e/1FAIpQLSdNtCou38N2JCLeJmmUpTMS_f8UXjMkkB__l4Y9GqMbY-lvQA/viewform",

  // FEEDBACK FORMS
  articlesFeedback: "https://docs.google.com/forms/d/e/1FAIpQLSfOyzlu1GyX6K8hPb-eEJkFrtF29naagFpdEuousHUfBaEZaA/viewform",
  clientFeedback: "https://docs.google.com/forms/d/e/1FAIpQLSesD1V0W1xP3uAGJkvgRrQX6iThf4XyQ4_5yiK4aLXIol-jtw/viewform",

  // SUGGESTION FORMS
  suggestionsSaHods: "https://docs.google.com/forms/d/e/1FAIpQLSe19sOaaI_8_w-m04RSMLVru7WepmmR1ZP8jCa8O2mjfuJtFA/viewform",
  suggestionsIaHods: "https://docs.google.com/forms/d/e/1FAIpQLSesD1V0W1xP3uAGJkvgRrQX6iThf4XyQ4_5yiK4aLXIol-jtw/viewform",
  suggestionHiringAuditExecutives: "https://docs.google.com/forms/d/10rLOlSIatv4oH_Uc3pKpf4LvlyVMaIeL7-A9rpHmkHI/edit",
  dailyWorking: "https://sites.google.com/view/ajc-daily-working/home",

  // FMS FORMS
  internalAudit: "https://docs.google.com/forms/d/e/1FAIpQLSdszuaFwklMaT-047VQq0v44v3JVN8Ie_jQuW7Grk68l1bUDQ/viewform",
  statutoryAudit: "https://docs.google.com/forms/d/e/1FAIpQLSchrC4TFaCE5wDZQOZNrsXDO3B3XLZbwdDNQygXUoIr_3RsAA/viewform",
  helpTicketFms: "https://docs.google.com/forms/d/e/1FAIpQLSc4MZrJnV1qeoneQY21sv1eQmQGg40kneNWlFBkFRvd50rnvA/viewform",

  // GROWTH HOUR FORMS  
  storesItemsIntegrated: "https://script.google.com/macros/s/AKfycbx1PGep6A_diVVzOLFHL74d7a0JZA3jSDIJUUMsOG8Q9lapPSNw0PxTPZg6s03FdMIE/exec",
  systemAudit: "https://docs.google.com/forms/d/1xXZYi5_Mwd1y_8Zd9LMSOGMGOT3HgBXf1G4lioCLsak/edit",
  rawMaterialForm: "https://docs.google.com/forms/d/1AyiwgNEK2gUgetkjSm_HGhxtgv-eRBWGO58sgesZo-Q/edit",
  marketingForm: "https://docs.google.com/forms/d/1A6WWtoOhMOiA6GmflH1kw2nXEwGD0PUsAK4dMoNcZ9Q/edit",


// DELEGATION FORMS
 backOfficeDelegation: "https://docs.google.com/forms/d/e/1FAIpQLScbOvnoIQ7mUly82dpkGnLXk1JD6w4joPQ2kBJ8Fp-JCKQNTA/viewform",
 ajcDelegation: "https://docs.google.com/forms/d/e/1FAIpQLSd41hGrB-zxvYrBxuRPYDdA4vnzp5c__K9ZKC4U_6TuSqEH8g/viewform",

// MASTER INFORMATION FORMS
 marketingWb: "https://docs.google.com/forms/d/e/1FAIpQLSckHo_b0KLqUJDQL4pPmKEvdrxM8Zf7bOC3lYL7fa1cLhDqJQ/viewform",
 generalQuestioners: "https://docs.google.com/forms/d/e/1FAIpQLSfM5v-q5yz8qW2vDUpDMaod13TVW8oP-bE0-kc8QZnsHwtAsg/viewform",
 accountsFinanceTaxationsLegal: "https://docs.google.com/forms/d/e/1FAIpQLSeLrWGgPXn1IAdN6Q7kaiT066BPzbylNB_Sx-W6klAR7NXIew/viewform",
 rawMaterial: "https://docs.google.com/forms/d/e/1FAIpQLSeJGhmkpEBxmepb_EpMC2JziGed2kMabBeMiIwx1rUP6oogbw/viewform",
 storePurchase: "https://docs.google.com/forms/d/e/1FAIpQLSdi0k2E86VA0FyZergbStS4pZ9c6dTngPfCunHQDBsPkkx9lQ/viewform",
 store: "https://docs.google.com/forms/d/e/1FAIpQLSerJuv2NEFq_PDOHb1dHd9UWAdRPZoKOeHxdxz_RMc--f1Aeg/viewform",
 vigilance: "https://docs.google.com/forms/d/e/1FAIpQLSdQpoPKy0lTJyb65FKJU_TLFYRYu7xuT3szvUU7bGnv_26caw/viewform",
 productionMaintenanceMis: "https://docs.google.com/forms/d/e/YOUR_PRODUCTION_MAINTENANCE_MIS_FORM_ID/viewform",
 edp: "https://docs.google.com/forms/d/e/1FAIpQLSfuQpNz21PJSWVI7PeS3oPJDODRs_DhrkvDk4e1U5Hz6XoV-Q/viewform",
 hr: "https://docs.google.com/forms/d/e/1FAIpQLSfJGwl0HNe-W5IUaKFlE3jQwHXRqN8DvGTPhhXdMoXY1ONs3w/viewform"
 };
const formCategories = [
   {
    title: "Feedback Forms",
    column: 1,
    items: [
      { name: "Article's Feedback Form", linkKey: "articlesFeedback" },
      { name: "Client Feedback Form", linkKey: "clientFeedback" }
    ]
  },
  {
    title: "AJC Forms",
    column: 1,
    items: [
      { name: "Client Master Form", linkKey: "clientMaster" },
      { name: "Price Comparision Form", linkKey: "priceComparison" },
      { name: "Borrowing Profile Form", linkKey: "borrowingProfile" },
      { name: "Pending Work With AJC Form", linkKey: "pendingWork" },
      { name: "Enquiry Capture Form", linkKey: "enquiryCapture" },
      { name: "AI Usage monthly form", linkKey: "aiUsageMonthly", isMixedCase: true },
      { name: "New System Form", linkKey: "newSystem" },
    ]
  },
  {
    title: "FMS Forms",
    column: 1,
    items: [
      { name: "Internal Audit Form", linkKey: "internalAudit" },
      { name: "Statutory Audit Form", linkKey: "statutoryAudit" },
      { name: "Help Ticket FMS", linkKey: "helpTicketFms" },
      
    ]
  },
  {
    title: "Delegation Forms",
    column: 1,
    items: [
      { name: "Back Office Delegation Form", linkKey: "backOfficeDelegation" },
      { name: "AJC Delegation Form", linkKey: "ajcDelegation" },
     
    ]
  },
 
  {
    title: "Suggestion Forms",
    column: 2,
    items: [
      { name: "Suggestions Form SA HODs", linkKey: "suggestionsSaHods" },
      { name: "Suggestions Form IA HODs", linkKey: "suggestionsIaHods" },
      { name: "Suggestion for Hiring New plant Audit Executives", linkKey: "suggestionHiringAuditExecutives", isMixedCase: true },
      { name: "Daily Working Form", linkKey: "dailyWorking" }
    ]
  },
  {
    title: "Growth Hour Forms",
    column: 2,
    items: [
      { name: "Number of Stores Items in Each Division of an Integrated...", linkKey: "storesItemsIntegrated", isMixedCase: true },
      { name: "System Audit Questionnaire", linkKey: "systemAudit" },
      { name: "Raw Material Form", linkKey: "rawMaterialForm" },
      { name: "Marketing Form", linkKey: "marketingForm" }
    ]
  },
  {
    title: "Master Information Forms",
    column: 2,
    items: [
      { name: "Marketing/WB", linkKey: "marketingWb", isMixedCase: true },
      { name: "General Questioners", linkKey: "generalQuestioners" },
      { name: "Accounts/Finance/Taxations & Legal Compliances", linkKey: "accountsFinanceTaxationsLegal" },
      { name: "Raw Material", linkKey: "rawMaterial" },
      { name: "Store Purchase", linkKey: "storePurchase" },
      { name: "Store", linkKey: "store" },
      { name: "Vigilance", linkKey: "vigilance" },
      { name: "Production/Maintenance/MIS", linkKey: "productionMaintenanceMis" },
      { name: "EDP", linkKey: "edp" },
      { name: "HR", linkKey: "hr" }
    ]
  },
];

export default function Forms() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");

  const handleFormClick = (linkKey) => {
    const url = FORM_LINKS[linkKey];
    if (url && url.startsWith("https://")) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      alert("This form link is not configured yet. Please configure the URL in Forms.jsx.");
    }
  };

  // Filter categories and items based on search input
  const filteredCategories = formCategories.map(category => {
    const filteredItems = category.items.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      category.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    return { ...category, items: filteredItems };
  }).filter(category => category.items.length > 0);

  // Divide into left and right columns dynamically based on filtered items
  const leftColumnCategories = filteredCategories.filter(cat => cat.column === 1);
  const rightColumnCategories = filteredCategories.filter(cat => cat.column === 2);

  return (
    <div className="forms-container">
      {/* HEADER SECTION */}
      <header className="forms-header">
        <div className="forms-nav-row">
          <button className="back-button" onClick={() => navigate(-1)}>
            ← Back
          </button>
          
          <div className="forms-search-box">
            <span className="forms-search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search forms..."
              className="forms-search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* DYNAMIC TWO COLUMN GRID */}
      <main className="forms-content-grid">
        {filteredCategories.length === 0 ? (
          <div className="no-results-msg">
            No forms match your search query.
          </div>
        ) : (
          <>
            {/* LEFT COLUMN */}
            <div className="forms-column">
              {leftColumnCategories.map((category, catIdx) => (
                <section key={catIdx} className="forms-category-section">
                  <h2 className="forms-category-title">{category.title}</h2>
                  <div className="forms-buttons-list">
                    {category.items.map((item, itemIdx) => (
                      <button
                        key={itemIdx}
                        onClick={() => handleFormClick(item.linkKey)}
                        className={`form-button-link ${item.isMixedCase ? "mixed-case" : ""}`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* RIGHT COLUMN */}
            <div className="forms-column">
              {rightColumnCategories.map((category, catIdx) => (
                <section key={catIdx} className="forms-category-section">
                  <h2 className="forms-category-title">{category.title}</h2>
                  <div className="forms-buttons-list">
                    {category.items.map((item, itemIdx) => (
                      <button
                        key={itemIdx}
                        onClick={() => handleFormClick(item.linkKey)}
                        className={`form-button-link ${item.isMixedCase ? "mixed-case" : ""}`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
