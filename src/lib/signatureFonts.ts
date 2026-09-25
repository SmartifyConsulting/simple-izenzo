// A standard set of cursive/signature-style web fonts a person can pick from for their digital
// signature — self-hosted via @fontsource (same pattern as the rest of the app's type), imported
// once here so any screen that needs to render or offer these fonts can just import this file.
import "@fontsource/dancing-script/400.css";
import "@fontsource/dancing-script/700.css";
import "@fontsource/great-vibes/400.css";
import "@fontsource/pacifico/400.css";
import "@fontsource/sacramento/400.css";
import "@fontsource/alex-brush/400.css";

export type SignatureFont = {
  id: string;
  label: string;
  family: string;
};

export const SIGNATURE_FONTS: SignatureFont[] = [
  { id: "dancing-script", label: "Dancing Script", family: "'Dancing Script', cursive" },
  { id: "great-vibes", label: "Great Vibes", family: "'Great Vibes', cursive" },
  { id: "pacifico", label: "Pacifico", family: "'Pacifico', cursive" },
  { id: "sacramento", label: "Sacramento", family: "'Sacramento', cursive" },
  { id: "alex-brush", label: "Alex Brush", family: "'Alex Brush', cursive" },
];

export function signatureFontFamily(id: string | null | undefined): string {
  return SIGNATURE_FONTS.find((f) => f.id === id)?.family ?? SIGNATURE_FONTS[0]!.family;
}
