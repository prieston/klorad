/**
 * Interface strings for the visitor-facing pages.
 *
 * Content has been multilingual since the data model landed — object titles,
 * descriptions and labels are all `Json` maps of BCP-47 tag to string. The
 * frame around that content was not, so a Greek museum served Greek objects
 * under English headings: "Scenes", "Tours", "20 min". That reads as a
 * translation someone gave up on halfway.
 *
 * Deliberately a plain object rather than an i18n runtime. There are a few
 * dozen strings, they are needed on the server during render, and every
 * library that would manage them costs more in bundle and indirection than
 * the problem is worth at this size. When a fourth language and pluralisation
 * rules arrive, revisit — not before.
 */

export type UiKey =
  | "scenes"
  | "tours"
  | "objects"
  | "noScenes"
  | "noTours"
  | "noObjects"
  | "noGeometry"
  | "splatNotPublished"
  | "noModel"
  | "language"
  | "venue"
  | "scene"
  | "object"
  | "objectType"
  | "period"
  | "materials"
  | "credit"
  | "rights"
  | "onDisplayIn"
  | "pointOfInterest"
  | "pointsOfInterest"
  | "backToVenue"
  | "minutes"
  | "accessibleRoute"
  | "notFound"
  | "viewInCollection"
  | "viewerLoading"
  | "viewerFailed"
  | "viewerHint"
  | "modelLabel"
  | "tour"
  | "stops"
  | "stopOf"
  | "previous"
  | "next"
  | "startTour"
  | "beginAt"
  | "endOfTour"
  | "backToTour"
  | "narration"
  | "allStops"
  | "accessibleRouteNote"
  | "screenOnly"
  | "headsetOnly"
  | "noStops";

type Dictionary = Record<UiKey, string>;

const en: Dictionary = {
  scenes: "Scenes",
  tours: "Tours",
  objects: "Objects",
  noScenes: "No scenes published yet.",
  noTours: "No tours published yet.",
  noObjects: "No objects published yet.",
  noGeometry: "No geometry has been published for this scene yet.",
  splatNotPublished:
    "This scene is a photorealistic capture. The renderer for it is not published yet — everything in it is listed below.",
  noModel: "No 3D model has been published for this object yet.",
  language: "Language",
  venue: "Venue",
  scene: "Scene",
  object: "Object",
  objectType: "Object type",
  period: "Period",
  materials: "Materials",
  credit: "Credit",
  rights: "Rights",
  onDisplayIn: "On display in",
  pointOfInterest: "Point of interest",
  pointsOfInterest: "Points of interest",
  backToVenue: "Back to the collection",
  minutes: "min",
  accessibleRoute: "accessible route",
  notFound: "Not found",
  viewInCollection: "View in the collection",
  viewerLoading: "Loading the model…",
  viewerFailed: "This model could not be loaded.",
  // `{n}` is substituted with the number of points of interest.
  viewerHint: "Drag to orbit · arrow keys to step through {n} points of interest",
  modelLabel: "Interactive 3D model",
  tour: "Tour",
  stops: "stops",
  // `{n}` and `{total}` are substituted.
  stopOf: "Stop {n} of {total}",
  previous: "Previous",
  next: "Next",
  startTour: "Start the tour",
  beginAt: "Begins at",
  endOfTour: "That is the end of the tour.",
  backToTour: "Back to the tour",
  narration: "Narration",
  allStops: "Every stop",
  accessibleRouteNote: "Step-free route",
  screenOnly: "Designed for screen",
  headsetOnly: "Designed for a headset",
  noStops: "This tour has no stops yet.",
};

const el: Dictionary = {
  scenes: "Σκηνές",
  tours: "Διαδρομές",
  objects: "Αντικείμενα",
  noScenes: "Δεν έχουν δημοσιευθεί σκηνές ακόμη.",
  noTours: "Δεν έχουν δημοσιευθεί διαδρομές ακόμη.",
  noObjects: "Δεν έχουν δημοσιευθεί αντικείμενα ακόμη.",
  noGeometry: "Δεν έχει δημοσιευθεί γεωμετρία για αυτή τη σκηνή ακόμη.",
  splatNotPublished:
    "Αυτή η σκηνή είναι φωτορεαλιστική αποτύπωση. Ο αντίστοιχος renderer δεν έχει δημοσιευθεί ακόμη — όλα τα περιεχόμενά της παρατίθενται παρακάτω.",
  noModel: "Δεν έχει δημοσιευθεί τρισδιάστατο μοντέλο για αυτό το αντικείμενο ακόμη.",
  language: "Γλώσσα",
  venue: "Μουσείο",
  scene: "Σκηνή",
  object: "Αντικείμενο",
  objectType: "Τύπος αντικειμένου",
  period: "Περίοδος",
  materials: "Υλικά",
  credit: "Μνεία",
  rights: "Δικαιώματα",
  onDisplayIn: "Εκτίθεται στην",
  pointOfInterest: "Σημείο ενδιαφέροντος",
  pointsOfInterest: "Σημεία ενδιαφέροντος",
  backToVenue: "Επιστροφή στη συλλογή",
  minutes: "λεπτά",
  accessibleRoute: "προσβάσιμη διαδρομή",
  notFound: "Δεν βρέθηκε",
  viewInCollection: "Προβολή στη συλλογή",
  viewerLoading: "Φόρτωση του μοντέλου…",
  viewerFailed: "Το μοντέλο δεν ήταν δυνατό να φορτωθεί.",
  viewerHint: "Σύρετε για περιστροφή · βέλη για μετάβαση σε {n} σημεία ενδιαφέροντος",
  modelLabel: "Διαδραστικό τρισδιάστατο μοντέλο",
  tour: "Διαδρομή",
  stops: "στάσεις",
  stopOf: "Στάση {n} από {total}",
  previous: "Προηγούμενη",
  next: "Επόμενη",
  startTour: "Έναρξη διαδρομής",
  beginAt: "Ξεκινά από",
  endOfTour: "Εδώ ολοκληρώνεται η διαδρομή.",
  backToTour: "Επιστροφή στη διαδρομή",
  narration: "Αφήγηση",
  allStops: "Όλες οι στάσεις",
  accessibleRouteNote: "Διαδρομή χωρίς σκαλοπάτια",
  screenOnly: "Σχεδιασμένη για οθόνη",
  headsetOnly: "Σχεδιασμένη για headset",
  noStops: "Αυτή η διαδρομή δεν έχει στάσεις ακόμη.",
};

export const DICTIONARIES: Record<string, Dictionary> = { en, el };

/** Exported so a check can assert every language carries every key. A missing
 *  entry falls back to English at runtime, which is the right behaviour and
 *  also the reason it would otherwise never be noticed. */
export const UI_KEYS = Object.keys(en) as UiKey[];

/** Languages the interface itself has been translated into. A venue may hold
 *  content in more; those fall back to English chrome rather than breaking. */
export const UI_LANGUAGES = Object.keys(DICTIONARIES);

/**
 * Resolve a translator for a language tag.
 *
 * Matches on the base language, so `el-GR` and `el-CY` both find Greek — the
 * same fallback rule `pickLocalized` uses for content, because chrome and
 * content disagreeing about which language a page is in would be worse than
 * either being wrong on its own.
 */
export function uiStrings(language: string | null | undefined): (key: UiKey) => string {
  const base = (language ?? "en").split("-")[0].toLowerCase();
  const dict = DICTIONARIES[base] ?? en;
  return (key: UiKey) => dict[key] ?? en[key];
}

/** Whether the interface is translated into this language, as opposed to
 *  falling back. Lets a page decide whether to apologise for mixed language. */
export function hasUiTranslation(language: string | null | undefined): boolean {
  const base = (language ?? "en").split("-")[0].toLowerCase();
  return base in DICTIONARIES;
}

/**
 * A language's name in that language — "Ελληνικά", not "Greek".
 *
 * A visitor scanning a QR code next to a label is looking for the word they
 * recognise. Showing them "Greek" in English, or a bare `el` tag, asks them to
 * do a translation step in order to ask for a translation.
 *
 * Falls back to the raw tag if the runtime has no display-name data, which is
 * still better than an empty button.
 */
export function languageName(tag: string): string {
  try {
    const names = new Intl.DisplayNames([tag], { type: "language" });
    return names.of(tag) ?? tag;
  } catch {
    return tag;
  }
}

/**
 * The status strings the viewer needs, bundled for passing straight into
 * `ViewerCanvas`.
 *
 * Kept as one helper rather than four call sites so a page cannot localise the
 * loading text and forget the failure text — a half-translated error message
 * is the worst of both.
 *
 * Returns plain strings, never a formatter function. A server component cannot
 * serialise a function across to a client component, and the failure is a
 * runtime 500 that both the type checker and the build wave through.
 */
export function viewerStrings(
  language: string | null | undefined,
  pointCount: number,
): { loading: string; failed: string; hint: string } {
  const ui = uiStrings(language);
  return {
    loading: ui("viewerLoading"),
    failed: ui("viewerFailed"),
    hint: ui("viewerHint").replace("{n}", String(pointCount)),
  };
}
