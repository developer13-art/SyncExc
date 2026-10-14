import { Navigate } from 'react-router-dom';

import { ROUTES } from '../../config/routes.config.js';

export default function FuturesTerminal() {
  return <Navigate to={ROUTES.app.terminal.overview} replace />;
}