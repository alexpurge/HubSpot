import { render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  it('renders category navigation', () => {
    render(<App />);

    expect(screen.getByText('Contacts')).toBeInTheDocument();
    expect(screen.getByText('Companies')).toBeInTheDocument();
    expect(screen.getByText('Deals')).toBeInTheDocument();
    expect(screen.getByText('Associations')).toBeInTheDocument();
    expect(screen.getByText('Owners')).toBeInTheDocument();
    expect(screen.getByText('Pipelines')).toBeInTheDocument();
    expect(screen.getByText('Properties')).toBeInTheDocument();
    expect(screen.getByText('Engagement')).toBeInTheDocument();
    expect(screen.getByText('Webhooks')).toBeInTheDocument();
  });
});
