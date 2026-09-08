// QESTIMA Revit bridge — source-only reference (Priority 6).
// Build against the Autodesk Revit API matching the user's installed version.
// The command exports an advisory JSON snapshot; it never writes BOQ values.
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Newtonsoft.Json;

namespace Qestima.RevitBridge
{
    [Transaction(TransactionMode.ReadOnly)]
    public sealed class ExportQestimaSnapshot : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            var document = commandData.Application.ActiveUIDocument?.Document;
            if (document == null) { message = "No active Revit document."; return Result.Failed; }
            var path = PickOutputPath(document);
            if (string.IsNullOrWhiteSpace(path)) return Result.Cancelled;
            var envelope = BuildSnapshot(document);
            File.WriteAllText(path, JsonConvert.SerializeObject(envelope, Formatting.Indented));
            TaskDialog.Show("QESTIMA", $"Exported {envelope.elements.Count:n0} elements for engineer review.\n{path}");
            return Result.Succeeded;
        }

        private static string PickOutputPath(Document document)
        {
            // Keep the add-in host-independent. A deployment can replace this
            // with a WPF SaveFileDialog or send the JSON directly to QESTIMA.
            var folder = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
            var name = Path.GetFileNameWithoutExtension(document.PathName);
            if (string.IsNullOrWhiteSpace(name)) name = "RevitModel";
            return Path.Combine(folder, $"{name}-QESTIMA-{DateTime.UtcNow:yyyyMMdd-HHmmss}.json");
        }

        private static Snapshot BuildSnapshot(Document document)
        {
            var modelVersion = document.Application.VersionBuild + " · " + (document.PathName ?? "unsaved");
            var rows = new FilteredElementCollector(document)
                .WhereElementIsNotElementType()
                .WherePasses(new LogicalOrFilter(new ElementIsClassFilter(typeof(MEPCurve)), new ElementIsClassFilter(typeof(FamilyInstance))))
                .Select(element => ToRow(document, element, modelVersion))
                .Where(row => row != null)
                .ToList();
            return new Snapshot { format = "qestima-revit-snapshot", version = 1, modelVersion = modelVersion, modelPath = document.PathName ?? "", exportedAt = DateTime.UtcNow.ToString("O"), advisoryOnly = true, elements = rows };
        }

        private static ModelElement ToRow(Document document, Element element, string modelVersion)
        {
            var type = element.Document.GetElement(element.GetTypeId()) as ElementType;
            var family = (type as FamilySymbol)?.FamilyName ?? type?.FamilyName ?? "";
            var category = element.Category?.Name ?? "";
            var row = new ModelElement
            {
                elementId = element.UniqueId,
                expressId = element.Id.IntegerValue,
                category = category,
                family = family,
                type = type?.Name ?? element.Name ?? "",
                system = SystemName(element),
                level = document.GetElement(element.LevelId)?.Name ?? "",
                zone = ZoneName(document, element),
                size = FirstParameter(element, "Diameter", "Width", "Height", "Size", "Nominal Diameter"),
                material = FirstParameter(element, "Material", "Material Name"),
                quantities = new Quantities
                {
                    length = ParameterValue(element, BuiltInParameter.CURVE_ELEM_LENGTH),
                    area = ParameterValue(element, BuiltInParameter.HOST_AREA_COMPUTED),
                    volume = ParameterValue(element, BuiltInParameter.HOST_VOLUME_COMPUTED),
                    count = 1
                },
                modelVersion = modelVersion,
                status = "pending",
                mappingStatus = "unmapped",
                boqItemId = "",
                rateAssemblyId = ""
            };
            return row;
        }

        private static string SystemName(Element element)
        {
            var curve = element as MEPCurve;
            return curve?.MEPSystem?.Name ?? FirstParameter(element, "System Name", "System Type") ?? "";
        }

        private static string ZoneName(Document document, Element element)
        {
            var room = (element as FamilyInstance)?.Room ?? (element as FamilyInstance)?.FromRoom;
            return room?.Name ?? "";
        }

        private static string FirstParameter(Element element, params string[] names)
        {
            foreach (var name in names)
            {
                var parameter = element.LookupParameter(name);
                if (parameter == null) continue;
                var value = parameter.AsString() ?? parameter.AsValueString();
                if (!string.IsNullOrWhiteSpace(value)) return value;
            }
            return "";
        }

        private static double ParameterValue(Element element, BuiltInParameter builtIn)
        {
            var parameter = element.get_Parameter(builtIn);
            if (parameter?.StorageType != StorageType.Double) return 0d;
            var unit = builtIn == BuiltInParameter.HOST_AREA_COMPUTED ? UnitTypeId.SquareMeters
                : builtIn == BuiltInParameter.HOST_VOLUME_COMPUTED ? UnitTypeId.CubicMeters : UnitTypeId.Meters;
            return UnitUtils.ConvertFromInternalUnits(parameter.AsDouble(), unit);
        }

        private sealed class Snapshot
        {
            public string format { get; set; }
            public int version { get; set; }
            public string modelVersion { get; set; }
            public string modelPath { get; set; }
            public string exportedAt { get; set; }
            public bool advisoryOnly { get; set; }
            public List<ModelElement> elements { get; set; }
        }

        private sealed class ModelElement
        {
            public string elementId { get; set; }
            public int expressId { get; set; }
            public string category { get; set; }
            public string family { get; set; }
            public string type { get; set; }
            public string system { get; set; }
            public string level { get; set; }
            public string zone { get; set; }
            public string size { get; set; }
            public string material { get; set; }
            public Quantities quantities { get; set; }
            public string modelVersion { get; set; }
            public string status { get; set; }
            public string mappingStatus { get; set; }
            public string boqItemId { get; set; }
            public string rateAssemblyId { get; set; }
        }

        private sealed class Quantities
        {
            public double length { get; set; }
            public double area { get; set; }
            public double volume { get; set; }
            public int count { get; set; }
        }
    }
}
