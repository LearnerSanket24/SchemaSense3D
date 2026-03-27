import React, { useEffect, useRef, useMemo } from 'react';
import mermaid from 'mermaid';
import { useVisualizationStore } from '../store/useVisualizationStore';

const toEntityName = (name) => String(name || '').replace(/[^a-zA-Z0-9_]/g, '_');
const cleanLabel = (value) => String(value || 'relates_to').replace(/"/g, "'").replace(/\n/g, ' ').trim();

const MermaidER = ({ erDefinition }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'loose',
      er: {
        useMaxWidth: true,
      },
    });
  }, []);

  useEffect(() => {
    if (erDefinition && containerRef.current) {
      const renderId = `er-diagram-svg-${Date.now()}`;
      mermaid.render(renderId, erDefinition).then((result) => {
        containerRef.current.innerHTML = result.svg;
      }).catch(err => {
        console.error("Mermaid parsing error: ", err);
        containerRef.current.innerHTML = '<div class="text-xs text-yellow-300">Unable to render ER diagram from current relationship payload.</div>';
      });
    }
  }, [erDefinition]);

  return <div ref={containerRef} className="w-full h-full flex justify-center items-center overflow-auto p-4" />;
};

export default function ERDiagram2D() {
  const { tables, relationships } = useVisualizationStore();

  const erDiagramString = useMemo(() => {
    let definition = 'erDiagram\n';

    // Output all tables with their columns (especially PKs/FKs)
    tables.forEach(table => {
      const entityName = toEntityName(table.id || table.name);
      definition += `  ${entityName} {\n`;
      (table.columns || []).forEach(col => {
        const type = String(col.type || 'string').replace(/[^a-zA-Z0-9_]/g, '');
        const colName = String(col.name || '').replace(/[^a-zA-Z0-9_]/g, '');
        let keys = '';
        if (col.is_pk || col.is_primary_key) keys += ' PK';
        if (col.is_fk || col.is_foreign_key) keys += ' FK';
        definition += `    ${type} ${colName}${keys}\n`;
      });
      definition += `  }\n`;
    });

    // Output all relationships
    relationships.forEach(rel => {
      const source = toEntityName(rel.source);
      const target = toEntityName(rel.target);
      if (!source || !target) return;
      
      // Determine cardinality based on prompt logic if provided by backend,
      // fallback to basic if not present.
      let operatorLeft = '||';
      let operatorRight = 'o{';
      
      if (rel.cardinality === 'one_to_one') {
        operatorLeft = '||'; operatorRight = '||';
      } else if (rel.cardinality === 'many_to_many') {
        operatorLeft = '}o'; operatorRight = 'o{';
      } else {
        // default one to many: one source contains many targets
        operatorLeft = '||'; operatorRight = 'o{';
      }

      const label = cleanLabel(rel.label || rel.sourceCol || rel.targetCol || 'relates_to');
      // Mermaid ER syntax: Entity1 ||--o{ Entity2 : "Label"
      // If we only have explicit relationship:
      definition += `  ${source} ${operatorLeft}--${operatorRight} ${target} : "${label}"\n`;
    });

    return definition;
  }, [tables, relationships]);

  return (
    <div className="absolute inset-0 bg-dark z-0 pt-20 pb-4 overflow-auto">
      {relationships.length === 0 ? (
        <div className="w-full h-full flex items-center justify-center p-6">
          <div className="max-w-md text-center rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
            No relationships were returned by backend for current upload. Re-upload all related CSVs and reload.
          </div>
        </div>
      ) : (
        <MermaidER erDefinition={erDiagramString} />
      )}
    </div>
  );
}
