export type DirtyGuardChoice = "save" | "discard" | "cancel";
export type DirtyGuardResolution = "saveAndContinue" | "discardAndContinue" | "stay";

export function resolveDirtyGuardChoice(choice: DirtyGuardChoice): DirtyGuardResolution {
  switch (choice) {
    case "save":
      return "saveAndContinue";
    case "discard":
      return "discardAndContinue";
    case "cancel":
      return "stay";
  }
}
