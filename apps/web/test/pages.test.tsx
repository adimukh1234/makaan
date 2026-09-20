import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Landing } from '../src/routes/landing';
import { Login } from '../src/routes/login';
import { Register } from '../src/routes/register';
import { NotFound } from '../src/routes/not-found';
import { renderWithProviders } from './render';

describe('landing page', () => {
  it('renders the value proposition and the advisory note', () => {
    renderWithProviders(<Landing />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Your home/i);
    expect(screen.getByText(/never holds your deposit/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Get started/i })).toBeInTheDocument();
  });

  it('renders the real problem numbers with a source', () => {
    renderWithProviders(<Landing />);
    expect(screen.getByText(/1,26,042 cr/)).toBeInTheDocument();
    expect(screen.getByText(/NoBroker Rent Report 2026/i)).toBeInTheDocument();
  });
});

describe('auth forms', () => {
  it('renders labelled login fields', () => {
    renderWithProviders(<Login />, '/login');
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in/i })).toBeInTheDocument();
  });

  it('renders the register form with consents', () => {
    renderWithProviders(<Register />, '/register');
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByLabelText('I am a')).toBeInTheDocument();
    expect(screen.getByText(/Provide the Makaan service/i)).toBeInTheDocument();
  });
});

describe('not found page', () => {
  it('explains the missing page and offers a way home', () => {
    renderWithProviders(<NotFound />);
    expect(screen.getByRole('heading', { name: /Page not found/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to home/i })).toBeInTheDocument();
  });
});
