import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import RegionPage from './pages/RegionPage';
import StationPage from './pages/StationPage';
import OfficerPage from './pages/OfficerPage';
import WritePage from './pages/WritePage';
import StatsPage from './pages/StatsPage';
import GuidePage from './pages/GuidePage';
import RemedyPage from './pages/RemedyPage';
import PolicyPage from './pages/PolicyPage';
import SearchPage from './pages/SearchPage';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="region/:id" element={<RegionPage />} />
        <Route path="station/:id" element={<StationPage />} />
        <Route path="officer/:id" element={<OfficerPage />} />
        <Route path="officer/:id/write" element={<WritePage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="guide" element={<GuidePage />} />
        <Route path="remedy" element={<RemedyPage />} />
        <Route path="remedy/:officerId" element={<RemedyPage />} />
        <Route path="policy" element={<PolicyPage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
