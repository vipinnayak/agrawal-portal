// src/utils/pmsFmsService.js
/**
 * BACKWARD COMPATIBILITY BRIDGE
 * 
 * Note: PMS and FMS have now been cleanly separated into two distinct modules:
 * 1. src/utils/pmsService.js  -> Exclusively for PMS (Performance Management System)
 * 2. src/utils/fmsService.js  -> Exclusively for FMS (Flow Management System / Internal Audit FMS)
 * 
 * This file re-exports both services so that existing imports continue to function seamlessly.
 */

// Re-export all PMS functions & constants
export * from "./pmsService";

// Re-export all FMS functions & constants
export * from "./fmsService";
