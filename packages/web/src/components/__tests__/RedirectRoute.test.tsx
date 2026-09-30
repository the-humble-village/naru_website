import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import { RedirectRoute } from '../RedirectRoute';

const Landed: React.FC = () => {
  const location = useLocation();
  return <div data-testid="landed">{location.pathname + location.search}</div>;
};

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/families/:id/children/new" element={<RedirectRoute to="/children/new?familyId=:id" />} />
        <Route path="/families/:id/children/:cid" element={<RedirectRoute to="/children/:cid" />} />
        <Route path="/families/:id/visits/*" element={<RedirectRoute to="/families/:id" />} />
        <Route path="/families/:id" element={<Landed />} />
        <Route path="/children/new" element={<Landed />} />
        <Route path="/children/:id" element={<Landed />} />
      </Routes>
    </MemoryRouter>
  );

describe('RedirectRoute', () => {
  it('redirects a family-nested child detail path to the flat child route', () => {
    renderAt('/families/1/children/2');
    expect(screen.getByTestId('landed')).toHaveTextContent('/children/2');
  });

  it('carries the family through as a query param when adding a child', () => {
    renderAt('/families/1/children/new');
    expect(screen.getByTestId('landed')).toHaveTextContent('/children/new?familyId=1');
  });

  it('collapses removed family-nested visit paths back to the family', () => {
    renderAt('/families/7/visits/3');
    expect(screen.getByTestId('landed')).toHaveTextContent('/families/7');
  });
});
