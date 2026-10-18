import { useState } from 'react'
import { ImportReportsModal } from './ImportReportsModal'
import { DownloadIcon, UploadIcon } from '../../components/ui/FormIcons'
import { downloadText } from '../../lib/csv'
import { reportsToCsv } from '../../lib/reportCsv'
import { fetchAllReports } from '../../lib/queries/admin'

const seg = 'flex h-8 items-center gap-1.5 px-2.5 text-xs font-semibold text-text-mute transition hover:bg-chip hover:text-text disabled:opacity-50'

/** CSV round-trip as one compact control: [⤓ Export | ⤒ Import]. */
export function ReportCsvTools() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)

  const exportAll = async () => {
    setBusy(true); setError(null)
    try {
      const rows = await fetchAllReports()
      downloadText(`recbuddy-reports-${new Date().toISOString().slice(0, 10)}.csv`, reportsToCsv(rows))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-missed" role="alert">{error}</span>}
      <div role="group" aria-label="CSV" className="flex divide-x divide-line overflow-hidden rounded-[10px] border border-line">
        <button type="button" className={seg} onClick={exportAll} disabled={busy}
          title="Download every report as a CSV — fill new_status, action and note to make changes offline">
          <DownloadIcon className="h-3.5 w-3.5" />{busy ? 'Exporting…' : 'Export'}
        </button>
        <button type="button" className={seg} onClick={() => setImportOpen(true)}
          title="Upload an edited export — every row is checked before anything changes">
          <UploadIcon className="h-3.5 w-3.5" />Import
        </button>
      </div>
      <ImportReportsModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  )
}
