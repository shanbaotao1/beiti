import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import ProgressPage from './pages/ProgressPage'
import ImportPage from './pages/ImportPage'
import StudyPage from './pages/StudyPage'
import WrongBookPage from './pages/WrongBookPage'
import ExamPage from './pages/ExamPage'
import BackupPage from './pages/BackupPage'
import { useCurrentBank } from './store/currentBank'

const navItems = [
  { to: '/', label: '题库', icon: '📚', end: true },
  { to: '/study', label: '背题', icon: '🃏' },
  { to: '/wrong', label: '错题', icon: '❌' },
  { to: '/exam', label: '自测', icon: '📝' },
  { to: '/backup', label: '备份', icon: '💾' }
]

export default function App() {
  const location = useLocation()
  const hideNav = location.pathname.startsWith('/study') || location.pathname.startsWith('/exam')
  return (
    <div className="flex h-full flex-col bg-slate-100">
      <main className="flex-1 overflow-y-auto">
        <Routes>
          <Route path="/" element={<ProgressPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/study" element={<StudyEntry />} />
          <Route path="/study/:bankId" element={<StudyPage />} />
          <Route path="/wrong" element={<WrongEntry />} />
          <Route path="/wrong/:bankId" element={<WrongBookPage />} />
          <Route path="/exam" element={<ExamEntry />} />
          <Route path="/exam/:bankId" element={<ExamPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {!hideNav && (
        <nav className="safe-bottom flex border-t border-slate-200 bg-white">
          {navItems.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${
                  isActive ? 'text-brand' : 'text-slate-400'
                }`
              }
            >
              <span className="text-lg leading-none">{it.icon}</span>
              {it.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  )
}

// 入口：无选中题库时跳到首页
function StudyEntry() {
  const bankId = useCurrentBank((s) => s.bankId)
  return bankId ? <Navigate to={`/study/${bankId}`} replace /> : <Navigate to="/" replace />
}
function WrongEntry() {
  const bankId = useCurrentBank((s) => s.bankId)
  return bankId ? <Navigate to={`/wrong/${bankId}`} replace /> : <Navigate to="/" replace />
}
function ExamEntry() {
  const bankId = useCurrentBank((s) => s.bankId)
  return bankId ? <Navigate to={`/exam/${bankId}`} replace /> : <Navigate to="/" replace />
}
