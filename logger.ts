import { CIQ } from "./js/advanced.js";

type TooledFunction = {
    parent: Function | object;
    functionName: string;
    scope: string;
};

type LoggerOutput = {
    time: Date;
    functionName: string;
    args: any[];
    returnValue?: any;
};

class CIQLogger {
    tooledCIQScopes: TooledFunction[];
    CIQinstance: typeof CIQ;
    output: LoggerOutput[];

    constructor({ CIQinstance }: { CIQinstance: typeof CIQ }) {
        this.CIQinstance = CIQinstance;
        this.tooledCIQScopes = [
            {
                scope: "data",
                parent: CIQ.ChartEngine.prototype,
                functionName: "loadChart",
            },
            {
                scope: "data",
                parent: CIQ.ChartEngine.Driver,
                functionName: "fetchData",
            },
            {
                scope: "layout",
                parent: CIQ.ChartEngine.prototype,
                functionName: "setRange",
            },
            {
                scope: "layout",
                parent: CIQ.ChartEngine.prototype,
                functionName: "setSpan",
            },
            {
                scope: "drawing",
                parent: CIQ.ChartEngine.prototype,
                functionName: "activateDrawing",
            },
            {
                scope: "drawing",
                parent: CIQ.ChartEngine.prototype,
                functionName: "drawingClick",
            },
            {
                scope: "drawing",
                parent: CIQ.ChartEngine.prototype,
                functionName: "changeVectorType",
            },
            {
                scope: "xaxis",
                parent: CIQ.ChartEngine.prototype,
                functionName: "createXAxis",
            },
            {
                scope: "xaxis",
                parent: CIQ.ChartEngine.prototype,
                functionName: "createSpacedDateXAxis",
            },
            {
                scope: "xaxis",
                parent: CIQ.ChartEngine.prototype,
                functionName: "drawXAxis",
            },
        ];

        this.output = [];
    };

   

    setScopes(
        scopes: "all" | String | Function | object | (Function | object)[],
    ) {
        let filteredFunctions: TooledFunction[];

        if (scopes === "all") {
            filteredFunctions = this.tooledCIQScopes;
        } else if (scopes !== "all" && typeof scopes === "string") {
            filteredFunctions = this.tooledCIQScopes.filter(
                (func) => func.scope.toLowerCase() === scopes.toLowerCase(),
            );
        } else {
            const scopesArray = Array.isArray(scopes) ? scopes : [scopes];
            filteredFunctions = this.tooledCIQScopes.filter((func) =>
                scopesArray.includes(func.scope),
            );
        }

        filteredFunctions.forEach(({ parent, functionName }) => {
            this.tool(parent, functionName);
        });
    }

    addLog(entry: LoggerOutput) {
        this.output.push(entry);
    }

    getLog() {
        return this.output;
    }

    clearLog() {
        this.output = [];
    }

    downloadLog(
        { depth = 10, space = 2 } = {},
        filename: string = `ciq_log_${new Date().getTime()}.json`,
    ) {
        const dataStr =
            "data:text/json;charset=utf-8," +
            encodeURIComponent(
                this.stringifyWithCircularPaths(this.output, {
                    depth: depth,
                    space: space,
                }),
            );
        const downloadAnchorNode = document.createElement("a");
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", filename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    }

    tool(parent: Function | object, funcName: string) {
        const logger = this;

        const originalFunction = (parent as any)[funcName];
        if (typeof originalFunction !== "function") {
            console.warn(
                `CIQLogger: No such function ${funcName} in ${parent} to tool.`,
            );
            return;
        }

        (parent as any)[funcName] = new Proxy(originalFunction, {
            apply(target: Function, thisArg: any, args: any[]) {
                logger.addLog({
                    time: new Date(),
                    functionName: funcName,
                    args,
                });

                console.log(
                    `CIQLogger: Called ${funcName} with arguments:`,
                    args,
                );
                const result = Reflect.apply(target, thisArg, args);
                if (result && typeof result.then === "function") {
                    return result.then((res: any) => {
                        logger.addLog({
                            time: new Date(),
                            functionName: funcName,
                            args,
                            returnValue: res,
                        });
                        console.log(`${funcName} returned (async):`, res);
                        return res;
                    });
                } else if (result || result === false) {
                    logger.addLog({
                        time: new Date(),
                        functionName: funcName,
                        args,
                        returnValue: result,
                    });
                    console.log(`${funcName} returned:`, result);
                }
                return result;
            },
        });
    }

    // some object reference stx and so are circular; handle them.
    stringifyWithCircularPaths(obj: any, { depth = 10, space = 2 } = {}) {
        console.log(depth);
        const seen = new WeakMap(); // object -> { path, level };
        const excludedObjects = {
            constructorNames: ["ChartEngine"],
            keys: ["stx"],
        };

        return JSON.stringify(
            obj,
            function (key, value) {
                const parent = seen.get(this) || { path: "$", level: 0 };
                const level = key === "" ? 0 : parent.level + 1;
                const path = key === "" ? "$" : `${parent.path}.${key}`;

                // Exclude configured objects
                if (value && typeof value === "object") {
                    const constructorNames =
                        excludedObjects.constructorNames || [];
                    const excludedKeys = excludedObjects.keys || [];

                    if (
                        value.constructor &&
                        constructorNames.includes(value.constructor.name)
                    ) {
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
                        const tag = Object.prototype.toString
                            .call(value)
                            .slice(8, -1);
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
                        stack: value.stack,
                    };

                return value;
            },
            space,
        );
    }
}

export { CIQLogger };
