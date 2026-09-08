# QESTIMA Revit Bridge (source only)

`QestimaRevitBridge.cs` is the Priority 6 reference command. It exports an advisory JSON snapshot from the active Revit model with:

- Category, Family and Type;
- MEP System, Level and Room/Zone where available;
- size/material parameters;
- length, area, volume and count;
- stable Revit `UniqueId`, integer element id and model version;
- empty BOQ/rate-assembly mapping fields ready for QESTIMA review.

The exported file is intentionally **pending review**. QESTIMA never replaces an approved BOQ quantity automatically. A user links elements to BOQ items, chooses a quantity field, approves the mapping, and only then applies the calculated takeoff quantity.

## Build notes

1. Create a Class Library targeting the .NET Framework supported by the installed Revit release.
2. Reference `RevitAPI.dll` and `RevitAPIUI.dll` from that installation.
3. Reference the Revit-compatible Newtonsoft.Json assembly.
4. Add an `.addin` manifest pointing to the compiled command and sign/deploy it according to the company’s Revit policy.

No compiled DLL, Revit SDK, or Autodesk binaries are included in QESTIMA. The bridge must be built and tested against the exact Revit version used by the customer.
