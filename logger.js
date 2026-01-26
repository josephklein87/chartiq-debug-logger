var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { CIQ } from "./js/advanced.js";
class CIQLogger {
  constructor({ CIQinstance }) {
    __publicField(this, "tooledCIQScopes");
    __publicField(this, "CIQinstance");
    __publicField(this, "output");
    this.CIQinstance = CIQinstance;
    this.tooledCIQScopes = [
      {
        scope: "data",
        parent: CIQ.ChartEngine.prototype,
        functionName: "loadChart"
      },
      {
        scope: "data",
        parent: CIQ.ChartEngine.Driver,
        functionName: "fetchData"
      },
      {
        scope: "layout",
        parent: CIQ.ChartEngine.prototype,
        functionName: "setRange"
      },
      {
        scope: "layout",
        parent: CIQ.ChartEngine.prototype,
        functionName: "setSpan"
      },
      {
        scope: "drawing",
        parent: CIQ.ChartEngine.prototype,
        functionName: "activateDrawing"
      },
      {
        scope: "drawing",
        parent: CIQ.ChartEngine.prototype,
        functionName: "drawingClick"
      },
      {
        scope: "drawing",
        parent: CIQ.ChartEngine.prototype,
        functionName: "changeVectorType"
      },
      {
        scope: "xaxis",
        parent: CIQ.ChartEngine.prototype,
        functionName: "createXAxis"
      },
      {
        scope: "xaxis",
        parent: CIQ.ChartEngine.prototype,
        functionName: "createSpacedDateXAxis"
      },
      {
        scope: "xaxis",
        parent: CIQ.ChartEngine.prototype,
        functionName: "drawXAxis"
      }
    ];
    this.output = [];
  }
  setScopes(scopes) {
    let filteredFunctions;
    if (scopes === "all") {
      filteredFunctions = this.tooledCIQScopes;
    } else if (scopes !== "all" && typeof scopes === "string") {
      filteredFunctions = this.tooledCIQScopes.filter(
        (func) => func.scope.toLowerCase() === scopes.toLowerCase()
      );
    } else {
      const scopesArray = Array.isArray(scopes) ? scopes : [scopes];
      filteredFunctions = this.tooledCIQScopes.filter(
        (func) => scopesArray.includes(func.scope)
      );
    }
    filteredFunctions.forEach(({ parent, functionName }) => {
      this.tool(parent, functionName);
    });
  }
  addLog(entry) {
    this.output.push(entry);
  }
  getLog() {
    return this.output;
  }
  clearLog() {
    this.output = [];
  }
  downloadLog({ depth = 10, space = 2 } = {}, filename = `ciq_log_${(/* @__PURE__ */ new Date()).getTime()}.json`) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(
      this.stringifyWithCircularPaths(this.output, {
        depth,
        space
      })
    );
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  }
  tool(parent, funcName) {
    const logger = this;
    const originalFunction = parent[funcName];
    if (typeof originalFunction !== "function") {
      console.warn(
        `CIQLogger: No such function ${funcName} in ${parent} to tool.`
      );
      return;
    }
    parent[funcName] = new Proxy(originalFunction, {
      apply(target, thisArg, args) {
        logger.addLog({
          time: /* @__PURE__ */ new Date(),
          functionName: funcName,
          args
        });
        console.log(
          `CIQLogger: Called ${funcName} with arguments:`,
          args
        );
        const result = Reflect.apply(target, thisArg, args);
        if (result && typeof result.then === "function") {
          return result.then((res) => {
            logger.addLog({
              time: /* @__PURE__ */ new Date(),
              functionName: funcName,
              args,
              returnValue: res
            });
            console.log(`${funcName} returned (async):`, res);
            return res;
          });
        } else if (result || result === false) {
          logger.addLog({
            time: /* @__PURE__ */ new Date(),
            functionName: funcName,
            args,
            returnValue: result
          });
          console.log(`${funcName} returned:`, result);
        }
        return result;
      }
    });
  }
  // some object reference stx and so are circular; handle them.
  stringifyWithCircularPaths(obj, { depth = 10, space = 2 } = {}) {
    console.log(depth);
    const seen = /* @__PURE__ */ new WeakMap();
    const excludedObjects = {
      constructorNames: ["ChartEngine"],
      keys: ["stx"]
    };
    return JSON.stringify(
      obj,
      function(key, value) {
        const parent = seen.get(this) || { path: "$", level: 0 };
        const level = key === "" ? 0 : parent.level + 1;
        const path = key === "" ? "$" : `${parent.path}.${key}`;
        if (value && typeof value === "object") {
          const constructorNames = excludedObjects.constructorNames || [];
          const excludedKeys = excludedObjects.keys || [];
          if (value.constructor && constructorNames.includes(value.constructor.name)) {
            return `[Excluded: ${value.constructor.name}]`;
          }
          if (excludedKeys.includes(key)) {
            return `[Excluded: ${key}]`;
          }
        }
        if (level > depth) {
          if (Array.isArray(value))
            return `[MaxDepth ${depth}] Array(${value.length})`;
          if (value && typeof value === "object") {
            const tag = Object.prototype.toString.call(value).slice(8, -1);
            return `[MaxDepth ${depth}] ${tag}`;
          }
          return value;
        }
        if (value && typeof value === "object") {
          if (seen.has(value))
            return `[Circular/Ref -> ${seen.get(value).path}]`;
          seen.set(value, { path, level });
        }
        if (value instanceof Date) return value.toISOString();
        if (value instanceof Error)
          return {
            name: value.name,
            message: value.message,
            stack: value.stack
          };
        return value;
      },
      space
    );
  }
}
export {
  CIQLogger
};
