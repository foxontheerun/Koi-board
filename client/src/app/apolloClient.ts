import { ApolloClient, InMemoryCache, split, HttpLink } from "@apollo/client";
import { SetContextLink } from "@apollo/client/link/context";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";
import { getAccessToken } from "../features/auth/lib/authStore";

const httpLink = new HttpLink({
  uri: "http://localhost:8080/query",
});

const authLink = new SetContextLink((prevContext) => {
  const token = getAccessToken();
  return {
    headers: {
      ...prevContext.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const wsLink =
  typeof window !== "undefined"
    ? new GraphQLWsLink(
        createClient({
          url: "ws://localhost:8080/query",
          connectionParams: () => {
            const token = getAccessToken();
            return token ? { authToken: token } : {};
          },
        }),
      )
    : null;

const httpChain = authLink.concat(httpLink);

const splitLink =
  wsLink != null
    ? split(
        ({ query }) => {
          const def = getMainDefinition(query);
          return (
            def.kind === "OperationDefinition" &&
            def.operation === "subscription"
          );
        },
        wsLink,
        httpChain,
      )
    : httpChain;

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});
