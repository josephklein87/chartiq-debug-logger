
# ChartIQ Debug Logger

This project creates a framework for a wrapper around ChartIQ functions for the purpose of generating logs for information helpful to debugging issues with the ChartIQ product.

## Included in Repo

This project includes the logger files that would need to be placed into your project. The configuration of these files can be changed to add new functions to log out.

Please reach out to the ChartIQ Developer Relations Team <chartiq-developer-relations@spglobal.com> with any questions regarding modifying the logger.

## Making changes

The logger uses esbuild to build a .js file from the original logger.ts file.

To track these changes run the following command in terminal from the root.

```bash
  npx esbuild logger.ts --outfile=logger.js --format=esm --target=es2020 --watch
```

This will track any changes you make to the ts file automatically.

If you wish to only build as needed, the following command, which will build once:

```bash
  npx esbuild logger.ts --outfile=logger.js --format=esm --target=es2020
```

## Testing

Place the logger files into your project and import them like so, keeping in mind your file structure may not reflect the below example:

```js
import { CIQLogger } from "./logger.js";
```
Then activate the logger with the following code: 

```js
window.CIQLogger = new CIQLogger({ CIQ });
window.CIQLogger.setScopes("all");
```

The setScopes command sets what the logger is tracking. As an example, if you wanted it to only track the functions involving the x-axis, you would write this instead:

window.CIQLogger.setScopes("all");

```js
window.CIQLogger.setScopes("xaxis");
```

It can also take an array of strings, if you want it to track multiple scopes. You may add new scopes by defining them in the logger.ts file. 

The current scopes are defined in the tooledCIQScopes object in logger.ts.

They are "data," "layout," "drawing," and "xaxis."

If you wish to export JSON of the logs up to this point, type the following in the console.

```js
  CIQLogger.downloadLog()
```





