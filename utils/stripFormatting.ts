// utils/stripFormatting.ts
type JSONNode = {
  type: string;
  text?: string;
  content?: JSONNode[];
};

/**
 * Walk a ProseMirror‐style JSON tree and return only the text,
 * inserting newlines for paragraphs and hardBreaks.
 */
export function stripFormatting(nodes?: JSONNode[]): string {
  // Add explicit checks for undefined and null
  if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
    return '';
  }
  
  let out = '';
  
  function walk(node: JSONNode) {
    // Add safety check for node
    if (!node || typeof node !== 'object') {
      return;
    }
    
    switch (node.type) {
      case 'text':
        out += node.text ?? '';
        break;
      case 'hardBreak':
        out += '\n';
        break;
      case 'paragraph':
        // descend into any children if present
        if (Array.isArray(node.content) && node.content.length > 0) {
          node.content.forEach(walk);
        }
        // always add a newline (so empty paragraphs still produce a blank line)
        out += '\n';
        break;
      default:
        // any other node, just recurse if it has content
        if (Array.isArray(node.content) && node.content.length > 0) {
          node.content.forEach(walk);
        }
    }
  }
  
  nodes.forEach(walk);
  
  // trim to remove any leading/trailing blank lines
  return out.trim();
}