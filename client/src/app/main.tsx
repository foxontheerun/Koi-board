import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import { ApolloProvider } from "@apollo/client/react";
import { apolloClient } from "./apolloClient";
import { BoardPage } from "../pages/board/ui/BoardPage";
import { BoardsListPage } from "../pages/boards/ui/BoardsListPage";
import { LoginPage } from "../pages/auth/ui/LoginPage";
import { SignupPage } from "../pages/auth/ui/SignupPage";
import { AuthProvider } from "../features/auth/model/AuthContext";
import { RequireAuth } from "../features/auth/ui/RequireAuth";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ApolloProvider client={apolloClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/"
              element={
                <RequireAuth>
                  <BoardsListPage />
                </RequireAuth>
              }
            />
            <Route
              path="/:id"
              element={
                <RequireAuth>
                  <BoardPage />
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ApolloProvider>
  </React.StrictMode>,
);
