import styles from './DataTable.module.css'

export interface Column {
  key: string
  label: string
}

export type Row = Record<string, React.ReactNode>

export function DataTable({ columns, rows }: { columns: Column[]; rows: Row[] }): JSX.Element {
  return (
    <div className={styles.tbl}>
      <div className={styles.tblHead}>
        {columns.map((h) => (
          <div key={h.key} className={styles.tblCell}>
            {h.label}
          </div>
        ))}
      </div>
      <div className={styles.tblBody}>
        {rows.map((r, i) => (
          <div key={i} className={styles.tblRow}>
            {columns.map((h) => (
              <div key={h.key} className={styles.tblCell}>
                <span className={styles.tblCellText}>{r[h.key]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}