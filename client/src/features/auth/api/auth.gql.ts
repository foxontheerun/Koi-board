import { gql } from "@apollo/client";

const AUTH_FIELDS = `
  accessToken
  refreshToken
  user {
    id
    email
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      ${AUTH_FIELDS}
    }
  }
`;

export const SIGNUP_MUTATION = gql`
  mutation Signup($email: String!, $password: String!) {
    signup(email: $email, password: $password) {
      ${AUTH_FIELDS}
    }
  }
`;

export const REFRESH_MUTATION = gql`
  mutation Refresh($refreshToken: String!) {
    refresh(refreshToken: $refreshToken) {
      ${AUTH_FIELDS}
    }
  }
`;
