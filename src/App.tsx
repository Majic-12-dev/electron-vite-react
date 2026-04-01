import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { CategoryPage } from '@/pages/CategoryPage'
import { HomePage } from '@/pages/HomePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ToolPage } from '@/pages/ToolPage'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path='category/:categoryId' element={<CategoryPage />} />
          <Route path='tool/:toolId' element={<ToolPage />} />
          <Route path='settings' element={<SettingsPage />} />
          <Route path='*' element={<Navigate to='/' replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
