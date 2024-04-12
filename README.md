# Manifest-Manipulator

<br><br>

# [1] Git Commit Message Format

협업 시 일관된 commit message 작성을 위해 템플릿을 이용합니다.  
commit message format은 [AngularJS commit message format](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)을 따릅니다.

### 1. 프로젝트 적용

1. 모든 프로젝트를 global로 적용하는 경우, **사용자 HOME 디렉토리** 에 생성한다.

```shell
touch ~/.gitmessage.txt
```

2. 현재 프로젝트에만 적용하는 경우, **프로젝트 루트 경로** 에 생성한다.

```shell
touch .gitmessage.txt
```

### 2. 템플릿 작성

위에서 생성한 `gitmessage.txt`의 내용을 작성합니다.  
이때 현재 repository에 있는 `.gitmessage.txt` 파일 내용 혹은 아래 코드를 복사하여 붙여넣습니다.

<details><summary>gitmessage.txt</summary>

```txt
################
# <타입> : <제목> 의 형식으로 제목을 아래 공백줄에 작성 (필수)
# 제목은 50자 이내로 아랫줄에 영문 명령문으로 작성(첫글자 대문자) / 변경사항이 "무엇"인지 명확하게 작성 / 끝에 마침표 금지
# (예시) feat : login

# 바로 아래 공백은 지우지 마세요 (제목과 본문의 분리를 위함)

################
# 본문(구체적인 내용)을 아랫줄에 작성 (선택사항)
# 여러 줄의 메시지를 작성할 땐 "-"로 구분 (한 줄은 72자 이내)

################
# 꼬릿말(footer)을 아랫줄에 작성 (선택사항) (현재 commit과 관련된 이슈 번호 등 추가)
# (예시) Close #5

################
# <타입 목록>
# feat : 새로운 기능 추가
# fix : 버그 수정
# docs : 문서화 및 문서 수정
# style : 코드 의미에 영향을 주지 않는 변경사항 (코드 포맷팅, 세미콜론 누락 등)
# refactor : 코드 리팩토링
# test : 테스트 코드 추가 및 수정
# chore : 빌드 부분 혹은 패키지 매니저 수정사항 (유지보수 및 그 외 수정사항)
# build : 빌드나, 외부 dependency에 영향 준 변경사항 (ex. npm, gulp 등)
################
```

</details>

### 3. git config를 template으로 설정하기

1. 모든 프로젝트를 global로 적용하는 경우

```shell
git config --global commit.template ~/.gitmessage.txt
```

2. 현재 프로젝트에만 적용하는 경우

```shell
git config commit.template .gitmessage.txt
```

### 4. (활용) commit message 작성

위 과정에서 git commit message를 config로 등록해주어, 템플릿 내용을 바탕을 commit message를 작성할 수 있다.

1. 터미널(git bash) 이용하는 경우
   - `git add` 다음에 `git commit` 명령어를 입력하면 vi 편집기가 열리면서 커밋 메시지 템플릿을 확인할 수 있다.
   - 템플릿의 맨 앞에 `#` 있는 부분은 주석 부분이니 이를 제외하고, 빈 줄에 주어진 템플릿에 따라 commit message를 작성한다.
2. VSCode 이용시
   - add 한 후 'commit'버튼을 클릭하면 `COMMIT_EDITMSG`창이 열리며 commit message를 편집할 수 있다.

<details><summary>작성 예시 </summary>

template의 가이드라인대로 `'아랫줄에 작성'` 문구의 비어있는 아랫 줄에 해당하는 내용을 작성한다.

```
################
# <타입> : <제목> 의 형식으로 제목을 아래 공백줄에 작성  (필수)
# 제목은 50자 이내로 아랫줄에 영문 명령문으로 작성(첫글자 대문자) / 변경사항이 "무엇"인지 명확하게 작성 / 끝에 마침표 금지
# (예시) feat : login
feat: onUrlChange event
# 바로 아래 공백은 지우지 마세요 (제목과 본문의 분리를 위함)

################
# 본문(구체적인 내용)을 아랫줄에 작성  (선택사항)
# 여러 줄의 메시지를 작성할 땐 "-"로 구분 (한 줄은 72자 이내)
- forward popstate event if available
- forward hashchange event if popstate not available
- do polling when neither popstate nor hashchange available

################
# 꼬릿말(footer)을 아랫줄에 작성 (선택사항) (현재 commit과 관련된 이슈 번호 등 추가)
# (예시) Close #5
Closes #392
################
# <타입 목록>
# feat : 새로운 기능 추가
# fix : 버그 수정
# docs : 문서화 및 문서 수정
# style : 코드 의미에 영향을 주지 않는 변경사항 (코드 포맷팅, 세미콜론 누락 등)
# refactor : 코드 리팩토링
# test : 테스트 코드 추가 및 수정
# chore : 빌드 부분 혹은 패키지 매니저 수정사항 (유지보수 및 그 외 수정사항)
# build : 빌드나, 외부 dependency에 영향 준 변경사항 (ex. npm, gulp 등)
################
```

</details>

<br><br>

# [2] Git branch Rule

## 브랜치 종류

1. `Main branch`
   - 기본 브랜치로 사용하며, 언제나 배포 가능한 상태로 유지
2. `develop branch`
   - `main` 브랜치에서 분기한 **개발 브랜치** 로, **새로운 기능 개발, 버그 수정** 등의 작업을 진행
3. `feature branch`
   - `develop` 브랜치에서 분기한 **기능 개발 브랜치** 입니다.
   - **각 개발자는 자신이 담당한 기능을 개발하기 위해 feature 브랜치를 만들어 작업합니다.** 작업이 완료되면 develop 브랜치로 merge 합니다.
   - 🌟 **Naming Convention** : `git checkout -b feature/{function} develop`
     - ex. `git checkout -b feature/login develop`
4. `hotfix branch`
   - main 브랜치에서 분기한 긴급 수정 브랜치입니다.
   - 버그 수정이나 보안 이슈 등이 발생했을 때 사용합니다. 이후 main 브랜치와 develop 브랜치로 merge합니다.

<br><br>

# [3] Node Version Control

### 1. Assign node version

```shell
nvm use
```

### 2. Install packages with dependencies

```shell
nvm install
```

### 3. Check Node version

```shell
node -v
v20.12.1
```

<br><br>

# [4] 주의 사항

- 코드 작업 시, 한 번에 많은 양을 commit하기 보다는 **작업 단위** 로 나누어 commit 부탁드립니다.
- git revert와 reset 하는 과정이 없도록 합니다.
- `Main`브랜치의 경우 배포 가능한 상태의 코드이므로, **바로 코드를 push하는 일이 없도록** 합니다.
- 개발은 개발 브랜치인 `develop`을 중점으로, 각자 맡은 개발 파트를 이름으로 하는 새로운 `feature branch`를 만들어 작업합니다.
  - 작업 후에는 `pull request`를 통해 동료에게 코드리뷰를 요청한 후 완료되면 **해당 branch는 삭제** 합니다.

## Running Server Locally
Run `npm start` in the project directory and access via localhost:3000.

## JS Formatting & Linting
Use Biome, included in the dev dependencies. To install editor extensions, follow instructions [here](https://biomejs.dev/guides/integrate-in-editor/).

## Deployment
`main` branch is deployed through GCP App Engine and will alwyas be available at https://manifest-manipulator.du.r.appspot.com.