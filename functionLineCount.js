import { ViewPlugin, Decoration, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";


class FunctionLineCountWidget extends WidgetType 
{
    constructor(linesCount, maxLines) 
    {
        super();
        this.linesCount = linesCount;
        this.maxLines = maxLines;
    }

    eq(other) 
    {
        return other.linesCount === this.linesCount && other.maxLines === this.maxLines;
    }

    toDOM() 
    {
        const span = document.createElement("span");
        const isAboveMax = this.maxLines > 0 && this.linesCount > this.maxLines;
        
        span.className = "cm-function-line-count";
        span.style.fontSize = "12.5px";
        span.style.fontStyle = "oblique";
        span.style.marginLeft = "15px";
        
        if (isAboveMax) 
        {
            span.textContent = `⚠⚠ FUNCTION LINES : ${this.linesCount} ⚠⚠`;
            span.style.color = "red";
        } 
        else 
        {
            span.textContent = `—— FUNCTION LINES : ${this.linesCount} ——`;
            span.style.color = "gray";
        }
        
        return span;
    }
}

function RegexFunctions(txt) 
{
    const out = [];
    let i = 0;
    while (i < txt.length) 
    {
        let start = 0;
        let temp = 0;
        let parentheses = 0;
        while (i < txt.length && !txt[i].match(/[a-zA-Z0-9_]/))
            i++;

        start = i;
        while (i < txt.length && txt[i].match(/[a-zA-Z0-9_]/))
            i++;

        if (i < txt.length && txt[i] === '(') 
        {
            parentheses = 1;
            i++;
            temp = i;
            while (i < txt.length && parentheses > 0 && txt[i] !== ';') 
            {
                if (txt[i] === '(') parentheses++;
                if (txt[i] === ')') parentheses--;
                i++;
            }
            if (i < txt.length && parentheses === 0) 
            {
                out.push([start, i, txt.substring(start, i)]);
            }
            i = temp;
        } 
    }
    return out;
}

function handleLiterals(c, ctx, i) 
{
    let skip = false;
    if (!ctx.inComment) 
    {
        if (c === '"' && !ctx.inChar) 
        {
            ctx.inString = !ctx.inString;
            i++;
            skip = true;
        } 
        else if (c === "'" && !ctx.inString) 
        {
            ctx.inChar = !ctx.inChar;
            i++;
            skip = true;
        }
    }
    return { skip, i };
}

function handleEscapeChar(c, ctx, i) 
{
    let skip = false;
    if ((ctx.inString || ctx.inChar) && c === '\\') 
    {
        i += 2;
        skip = true;
    }
    return { skip, i };
}

function handleComment(c, ctx, txt, i) 
{
    let skip = false;
    if (!ctx.inString && !ctx.inChar) 
    {
        if (!ctx.inComment && txt.substring(i, i + 2) === '//') 
        {
            ctx.inLineComment = true;
            i += 2;
            skip = true;
        } 
        else if (ctx.inLineComment && c === '\n') 
        {
            ctx.inLineComment = false;
            skip = true;
        } 
        else if (!ctx.inComment && txt.substring(i, i + 2) === '/*') 
        {
            ctx.inBlockComment = true;
            i += 2;
            skip = true;
        } 
        else if (ctx.inBlockComment && txt.substring(i - 1, i + 1) === '*/') 
        {
            ctx.inBlockComment = false;
            i++;
            skip = true;
        }
    }
    return { skip, i };
}

function checkExclusionContext(c, ctx, txt, i) 
{
    let skip = false;

    ({ skip, i } = handleLiterals(c, ctx, i));
    if (skip) return { skip, i };

    ({ skip, i } = handleEscapeChar(c, ctx, i));
    if (skip) return { skip, i };

    ({ skip, i } = handleComment(c, ctx, txt, i));
    
    return { skip, i };
}

function countBrackets(c, ctx, brackets, i) 
{
    if (!ctx.inString && !ctx.inChar && !ctx.inComment) 
    {
        if (c === '{') brackets += 1;
        else if (c === '}') brackets -= 1;
    }
    i += 1;
    return { brackets, i };
}

function countFunctionLines(start, end, txt) 
{
    let size = 0;
    while (start < end) 
    {
        if (txt[start] === '\n') size += 1;
        start += 1;
    }
    return size;
}

/**
 * lineCountPlugin
 * 
 * CodeMirror 6 plugin that analyzes the document and provides decorations.
 */
const lineCountPlugin = ViewPlugin.fromClass(class {
    constructor(view) 
    {
        this.decorations = this.buildDecorations(view);
    }

    update(update) 
    {
        if (update.docChanged || update.viewportChanged) 
        {
            this.decorations = this.buildDecorations(update.view);
        }
    }

    buildDecorations(view) 
    {
        const txt = view.state.doc.toString();
        const allResRegex = RegexFunctions(txt);
        const widgets = [];
        
        // Configuration: max lines threshold
        const maxLines = 25; 

        for (let resRegex of allResRegex) 
        {
            let ctx = {
                inString: false,
                inChar: false,
                inComment: false,
                inLineComment: false,
                inBlockComment: false,
            };

            // Assuming standard C style: functionName() \n {
            if (txt[resRegex[1]] === '\n' && txt[resRegex[1] + 1] === '{') 
            {
                let i = resRegex[1] + 2;
                let brackets = 1;

                while (brackets !== 0 && i < txt.length) 
                {
                    let c = txt[i];
                    let skip;

                    ({ skip, i } = checkExclusionContext(c, ctx, txt, i));
                    if (skip) continue;

                    ctx.inComment = ctx.inLineComment || ctx.inBlockComment;
                    ({ brackets, i } = countBrackets(c, ctx, brackets, i));
                }
                
                let start = resRegex[1] + 3;
                let end = i - 1;
                let size = countFunctionLines(start, end, txt);
                
                // Add the widget exactly after the closing bracket '}'
                if (end < txt.length) 
                {
                    widgets.push({
                        pos: end + 1,
                        widget: Decoration.widget({
                            widget: new FunctionLineCountWidget(size, maxLines),
                            side: 1
                        })
                    });
                }
            }
        }

        // CodeMirror 6 requires decorators to be sorted by position
        widgets.sort((a, b) => a.pos - b.pos);
        
        const builder = new RangeSetBuilder();
        for (const w of widgets) 
        {
            builder.add(w.pos, w.pos, w.widget);
        }
        
        return builder.finish();
    }
}, {
    decorations: v => v.decorations
});

/**
 * Export the extension to be used in EditorState
 */
export function functionLineCount() 
{
    return [lineCountPlugin];
}