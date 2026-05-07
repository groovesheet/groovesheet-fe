import { s as styled, r as reactExports, G as GoogleAuthProvider, z as GithubAuthProvider, T as ThemeProvider, C as configure, D as clientExports } from "./index-BsFNT9rD.js";
import { j as jsxs, a as jsx, d as Localized, S as StyledFirebaseAuth, b as auth, t as themes, G as GlobalCSS, g as LocalizationContext } from "./GlobalCSS-CgrwHkuo.js";
const Container$1 = styled.div`
  text-align: center;
  padding: 20px;
  border-radius: 10px;
  background-color: var(--color-background-dark);
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-width: 30rem;
  margin: 10rem auto;
`;
const Title$1 = styled.h1`
  color: var(--color-theme);
`;
const Text = styled.p`
  color: var(--color-text-secondary);
`;
const SignInSuccessPage = () => {
  return /* @__PURE__ */ jsxs(Container$1, { children: [
    /* @__PURE__ */ jsx(Title$1, { children: "Authentication Successful" }),
    /* @__PURE__ */ jsx(Text, { children: "You may now close this page." }),
    /* @__PURE__ */ jsx(Text, { children: "Thank you for using signal." })
  ] });
};
const Title = styled.div`
  font-size: 1.25rem;
  color: var(--color-text);
  margin-bottom: 1.5rem;
`;
const Content = styled.div`
  overflow-x: hidden;
  overflow-y: auto;
  margin-bottom: 1rem;
`;
const Container = styled.div`
  padding: 2rem 3rem;
`;
const SignInPage = () => {
  const [isSucceeded, setIsSucceeded] = reactExports.useState(false);
  if (isSucceeded) {
    return /* @__PURE__ */ jsx(SignInSuccessPage, {});
  }
  return /* @__PURE__ */ jsxs(Container, { children: [
    /* @__PURE__ */ jsx(Title, { children: /* @__PURE__ */ jsx(Localized, { name: "sign-in" }) }),
    /* @__PURE__ */ jsx(Content, { children: /* @__PURE__ */ jsx(
      StyledFirebaseAuth,
      {
        uiConfig: {
          signInOptions: [
            GoogleAuthProvider.PROVIDER_ID,
            GithubAuthProvider.PROVIDER_ID,
            "apple.com"
          ],
          callbacks: {
            signInSuccessWithAuthResult: ({ credential }) => {
              const redirectUrl = new URLSearchParams(location.search).get(
                "redirect_uri"
              );
              if (redirectUrl && (redirectUrl.startsWith("jp.codingcafe.signal://") || redirectUrl.startsWith("jp.codingcafe.signal.dev://"))) {
                const url = redirectUrl + "?credential=" + JSON.stringify(credential);
                try {
                  location.assign(url);
                  setIsSucceeded(true);
                } catch {
                  alert("Failed to open the app. Please try again.");
                }
              }
              return false;
            },
            signInFailure(error) {
              console.error(error);
              alert("Failed to sign in. Please try again.");
            }
          },
          signInFlow: "popup"
        },
        firebaseAuth: auth
      }
    ) })
  ] });
};
const App = () => {
  return /* @__PURE__ */ jsx(ThemeProvider, { theme: themes.dark, children: /* @__PURE__ */ jsxs(LocalizationContext.Provider, { value: { language: null }, children: [
    /* @__PURE__ */ jsx(GlobalCSS, {}),
    /* @__PURE__ */ jsx(SignInPage, {})
  ] }) });
};
configure({
  enforceActions: "never"
});
const root = clientExports.createRoot(document.querySelector("#root"));
root.render(/* @__PURE__ */ jsx(App, {}));
//# sourceMappingURL=auth-DxjXyvHs.js.map
