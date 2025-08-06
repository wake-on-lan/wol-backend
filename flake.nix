{
  description = "Claude Code development environment with auto VSCode launch";
  
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };
  
  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { 
          inherit system; 
          config = {
            allowUnfree = true;
            allowUnfreePredicate = _: true;
          };
        };
        
        # Use the actual claude-code package from nixpkgs
        
        devEnv = pkgs.buildEnv {
          name = "claude-dev-env";
          paths = with pkgs; [
            curl
            jq
            nodejs_20
            claude-code
          ];
        };
        
      in {
        devShells.default = pkgs.mkShell {
          name = "claude-dev-shell";
          buildInputs = [ devEnv ];
          
          shellHook = ''
            code .
          '';
        };
      });
}
