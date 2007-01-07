// constants
const APP_DISPLAY_NAME = "Adblock Plus: Element Hiding Helper";
const APP_NAME = "elemhidehelper";
const APP_PACKAGE = "/elemhidehelper.adblockplus.org";
const APP_VERSION = "{{VERSION}}";
const VERSION_ERROR = "This extension can only be installed in a browser based on Gecko 1.8 or higher, please upgrade your browser. Compatible browsers include Firefox 1.5, SeaMonkey 1.0 and Flock 0.5.";
const locales = [
  "{{LOCALE}}",
  null
];

// Gecko 1.7 doesn't support custom button labels
var incompatible = (typeof Install.BUTTON_POS_0 == "undefined");
if (incompatible)
  alert(VERSION_ERROR);

if (!incompatible) {
  // initialize our install
  initInstall(APP_NAME, APP_PACKAGE, APP_VERSION);
  
  // Install jar
  var jarFolder = getFolder("Profile", "chrome");
  addFile(APP_NAME, APP_VERSION, "chrome/elemhidehelper.jar", jarFolder, null);

  var jar = getFolder(jarFolder, "elemhidehelper.jar");
  try {
    var err = registerChrome(CONTENT | PROFILE_CHROME, jar, "content/");
    if (err != SUCCESS)
      throw "Chrome registration for content failed (error code " + err + ").";

    err = registerChrome(SKIN | PROFILE_CHROME, jar, "skin/classic/");
    if (err != SUCCESS)
      throw "Chrome registration for skin failed (error code " + err + ").";

    for (i = 0; i < locales.length; i++) {
      if (!locales[i])
        continue;

      err = registerChrome(LOCALE | PROFILE_CHROME, jar, "locale/" + locales[i] + "/");
      if (err != SUCCESS)
        throw "Chrome registration for " + locales[i] + " locale failed (error code " + err + ").";
    }

    var err = performInstall();
    if (err != SUCCESS && err != 999)
      throw "Committing installation failed (error code " + err + ").";

    alert("Element Hiding Helper " + APP_VERSION + " is now installed.\n" +
          "It will become active after you restart your browser.");
  }
  catch (ex) {
    alert("Installation failed: " + ex + "\n" +
          "You probably don't have the necessary permissions (log in as system administrator).");
    cancelInstall(err);
  } 
}
