import * as React from "react";
import { NavLink, Table } from "tabler-react";
import { ToastContainer, toast } from "react-toastify";
import { Row, Col, Container, Media, Button, Nav, ProgressBar, Breadcrumb, DropdownButton, Dropdown } from "react-bootstrap";
import TreeMenu, { TreeMenuProps, ItemComponent } from "react-simple-tree-menu";
import { Account, AccountGetRes, AccountCreationInvoice } from "../../../ts-client-library/packages/account-management"
import { AccountSystem, MetadataAccess, FileMetadata, FolderMetadata } from "../../../ts-client-library/packages/account-system"
import { WebAccountMiddleware, WebNetworkMiddleware } from "../../../ts-client-library/packages/middleware-web"
import { bytesToB64, b64ToBytes } from "../../../ts-client-library/packages/util/src/b64"
import { polyfillReadableStream } from "../../../ts-client-library/packages/util/src/streams"
import { Upload, bindUploadToAccountSystem } from "../../../ts-client-library/packages/opaque"
import { theme, FILE_MAX_SIZE } from "../../config";
import RenameModal from "../../components/RenameModal/RenameModal";
import DeleteModal from "../../components/DeleteModal/DeleteModal"
import "./FileManagePage.scss";
import { formatBytes, formatGbs } from "../../helpers"
import * as moment from 'moment';
import { DndProvider, useDrop, DropTargetMonitor } from 'react-dnd'
import { HTML5Backend, NativeTypes } from 'react-dnd-html5-backend'
const uploadImage = require("../../assets/upload.png");

const storageNode = "http://18.191.166.234:3000";
const typeList = {
  "text/plain": 'document',
  "application/x-zip-compressed": 'zip',
  "image/png":'image'
}
// const fileList = [
//   {
//     name: "Movies",
//     type: "folder",
//     size: "8 iteams",
//     created: "Yesterday",
//   },
//   {
//     name: "New Folder",
//     type: "folder",
//     size: "3 iteams",
//     created: "Today",
//   },
//   {
//     name: "Pictures",
//     type: "folder",
//     size: "115 iteams",
//     created: "June 23",
//   },
//   {
//     name: "Document.txt",
//     type: "document",
//     size: "947 B",
//     created: "Yesterday",
//   },
//   {
//     name: "Example.png",
//     type: "image",
//     size: "12.4 MB",
//     created: "Feb 19",
//   },
//   {
//     name: "Files.tar",
//     type: "zip",
//     size: "1.5 GB",
//     created: "Jul 8",
//   },
//   {
//     name: "Video.mkv",
//     type: "video",
//     size: "133.8 MB",
//     created: "Dec 17,2020",
//   },
// ];
const logo = require("../../assets/logo2.png");
const FileManagePage = ({ history }) => {
  const cryptoMiddleware = new WebAccountMiddleware({ asymmetricKey: b64ToBytes(localStorage.getItem('key')) });
  const netMiddleware = new WebNetworkMiddleware();
  const metadataAccess = new MetadataAccess({
    net: netMiddleware,
    crypto: cryptoMiddleware,
    metadataNode: storageNode,
  });
  const accountSystem = new AccountSystem({ metadataAccess });
  const account = new Account({ crypto: cryptoMiddleware, net: netMiddleware, storageNode })
  const [updateStatus, setUpdateStatus] = React.useState(false);
  const [showSidebar, setShowSidebar] = React.useState(false);
  const [tableView, setTableView] = React.useState(true);
  const [currentPath, setCurrentPath] = React.useState('/')
  const [fileList, setFileList] = React.useState([])
  const [folderList, setFolderList] = React.useState([]);
  const [treeData, setTreeData] = React.useState([
    // {
    //   key: "first-level-node-1",
    //   label: "My Folders",
    //   nodes: [
    //     {
    //       key: "0-level-node-1",
    //       label: "Movies",
    //     },
    //     {
    //       key: "1-level-node-1",
    //       label: "New Folder",
    //     },
    //     {
    //       key: "2-level-node-1",
    //       label: "Pictures",
    //     },
    //   ],
    // },
  ]);
  const [subPaths, setSubPaths] = React.useState([])
  const [accountInfo, setAccountInfo] = React.useState<AccountGetRes>();
  const [showRenameModal, setShowRenameModal] = React.useState(false);
  const [renameFile, setRenameFile] = React.useState<FileMetadata>()
  const [renameFolder, setRenameFolder] = React.useState<FolderMetadata>()
  const [oldName, setOldName] = React.useState();
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const handleShowSidebar = () => {
    setShowSidebar(!showSidebar);
  };
  React.useEffect(() => {
    getFolderData();
  }, [updateStatus]);
  React.useEffect(() => {
    const levels = currentPath.split("/").slice(1);
    const subpaths = levels.map((l, i) => {
      const parentFolders = levels.filter((_l, idx) => idx < i);
      const parentPaths =
        "/" +
        (parentFolders.length > 0 ? parentFolders.join("/") + "/" : "");

      return { text: l, path: parentPaths + l };
    });
    setSubPaths(subpaths);
    accountSystem.getFolderMetadataByPath(currentPath).then(async res => {
      let g = await accountSystem.getFoldersInFolderByPath(currentPath);
      let folders = g.map(async folder => {
        return await accountSystem.getFolderMetadataByPath(folder.path);
      })
      let folderlist = await Promise.all(folders);
      console.log(folderlist)
      setFolderList(folderlist);
      let filelist = res.files.map(async file => {
        return await accountSystem.getFileMetadata(file.location)
      })

      Promise.all(filelist).then(res => {
        res.map(file => {
          file.type = typeList[file.type] || file.type
        })
        setFileList(res);
        console.log(res)
      })
    }).catch(err => {
      toast.error(`folder "${currentPath}" not found`)
    })
  }, [currentPath, updateStatus]);
  const getFolderData = async () => {
    const accountInfo = await account.info();
    setAccountInfo(accountInfo);
    // const a = await accountSystem.renameFile(filesIndex.files[0].location,'test.txt');
    const t = await accountSystem.getFoldersIndex();
    function filesToTreeNodes(arr) {
      var tree = {}
      function addnode(obj) {
        var splitpath = obj.path.replace(/^\/|\/$/g, "").split('/');
        var ptr = tree;
        for (let i = 0; i < splitpath.length; i++) {
          let node: any = {
            label: splitpath[i],
            key: 'level-' + splitpath[i] + '-' + i,
            isDirectory: true,
            path: obj.path,
            location: obj.location
          };
          if (i == splitpath.length - 1) {
            node.isDirectory = false
          }
          ptr[splitpath[i]] = ptr[splitpath[i]] || node;
          ptr[splitpath[i]].nodes = ptr[splitpath[i]].nodes || {};
          ptr = ptr[splitpath[i]].nodes;
        }
      }
      function objectToArr(node) {
        Object.keys(node || {}).map((k) => {
          if (node[k].nodes) {
            objectToArr(node[k])
          }
        })
        if (node.nodes) {
          node.nodes = Object.values(node.nodes)
          node.nodes.forEach(objectToArr)
        }
      }
      arr.map(addnode);
      objectToArr(tree)
      return Object.values(tree)
    }
    let arrayList = filesToTreeNodes(t.folders)
    let temp = []
    temp[0] = arrayList[0];
    temp[0].label = 'Root'
    arrayList.splice(0, 1);
    temp[0].nodes = arrayList
    setTreeData(temp);
  }
  const handleLogout = () => {
    localStorage.clear();
    history.push('/');
  }
  const relativePath = path => path.substr(0, path.lastIndexOf("/"));

  const selectFiles = async (files) => {
    return files.map(file =>
      // Current path or subdirectory
      (file.name === (file.path || file.webkitRelativePath || file.name))
        ? uploadFile(file, currentPath)
        : uploadFile(
          file,
          currentPath === "/"
            ? file.webkitRelativePath ? currentPath + relativePath(file.webkitRelativePath) : relativePath(file.path)
            : file.webkitRelativePath ? currentPath + "/" + relativePath(file.webkitRelativePath) : currentPath + relativePath(file.path),

        )
    );
  }
  const uploadFile = async (file, path) => {
    try {
      const upload = new Upload({
        config: {
          crypto: cryptoMiddleware,
          net: netMiddleware,
          storageNode: storageNode,
        },
        meta: file,
        name: file.name,
        path: path,
      })
      let handle = file.size + file.name
      // side effects
      bindUploadToAccountSystem(accountSystem, upload)

      const stream = await upload.start()
      toast(`${file.name} is uploading. Please wait...`, { toastId: handle, autoClose: false, });
      // if there is no error
      if (stream) {
        polyfillReadableStream<Uint8Array>(file.stream()).pipeThrough(stream)
      } else {
        toast.update(handle, {
          render: `An error occurred while uploading ${file.name}.`,
          type: toast.TYPE.ERROR,
        })
      }
      await upload.finish()
      toast.update(handle, { render: `${file.name} has finished uploading.` })
      setUpdateStatus(!updateStatus);
      setTimeout(() => {
        toast.dismiss(handle);
      }, 3000);
    } catch (e) {
      toast.update(file.size + file.name, {
        render: `An error occurred while uploading ${file.name}.`,
        type: toast.TYPE.ERROR,
      })

    }

  }
  const addNewFolder = async () => {
    try {
      let folderName = 'my folder';
      // const status = await accountSystem.addFolder(currentPath === '/' ? currentPath + folderName : currentPath + '/' + folderName)
      toast(`Folder ${folderName} was successfully created.`);
      setUpdateStatus(!updateStatus);
    } catch (e) {
      toast.error(`An error occurred while creating new folder.`)
    }
  }
  const fileShare = async (file: FileMetadata) => {
    try {
    } catch (e) {
      toast.error(`An error occurred while sharing ${file.name}.`)

    }
  }
  const fileDownload = async (file: FileMetadata) => {
    try {

    } catch (e) {
      toast.error(`An error occurred while downloading ${file.name}.`)

    }
  }
  const deletFile = async (file: FileMetadata) => {
    try {
      const status = await accountSystem.removeFile(file.location);
      toast(`${file.name} was successfully deleted.`);
      setUpdateStatus(!updateStatus);
      setRenameFile(null)
    } catch (e) {
      toast.error(`An error occurred while deleting ${file.name}.`)
    }
  }
  const deletFolder = async (folder: FolderMetadata) => {
    try {
      const status = await accountSystem.removeFolderByPath(folder.path);
      toast(`Folder ${folder.name} was successfully deleted.`);
      setUpdateStatus(!updateStatus);
      setRenameFolder(null);
    } catch (e) {
      console.log(e)
      toast.error(`An error occurred while deleting Folder ${folder.name}.`)
    }
  }
  const handleOpenRenameModal = (item, isFile) => {
    setOldName(item.name)
    if (isFile) setRenameFile(item)
    else setRenameFolder(item)
    setShowRenameModal(true)
  }
  const handleChangeRename = async (rename) => {
    try {
      setShowRenameModal(false);
      setOldName(null);
      if (renameFile) {
        const status = await accountSystem.renameFile((renameFile.location), rename);
        toast(`${renameFile.name} was renamed successfully.`);
      }
      if (renameFolder) {
        const status = await accountSystem.renameFolder((renameFolder.path), rename);
        toast(`${renameFolder.name} was renamed successfully.`);
      }
      setRenameFolder(null);
      setRenameFile(null);
      setUpdateStatus(!updateStatus)
    } catch (e) {
      console.log(e)
      toast.error(`An error occurred while rename ${rename}.`)
    }
  }
  const handleDeleteItem = (item, isFile) => {
    if (isFile) setRenameFile(item)
    else setRenameFolder(item)
    setShowDeleteModal(true)
  }
  const handleDelete = async () => {
    if (renameFolder) deletFolder(renameFolder)
    else deletFile(renameFile)
    setShowDeleteModal(false)
  }
  const handleDrop = React.useCallback(item => {
    if (item) selectFiles(item.files);
  }, []);
  const [{ canDrop, isOver }, drop] = useDrop(
    () => ({
      accept: [NativeTypes.FILE],
      drop(item: { files: any[] }) {
        if (handleDrop) {
          handleDrop(item)
        }
      },
      collect: (monitor: DropTargetMonitor) => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
    }),
    [],
  )

  const isActive = canDrop && isOver
  return (
    <div className='page'>
      <div className='mobile-header'>
        <button
          className='navbar-toggler'
          type='button'
          data-bs-toggle='collapse'
          data-bs-target='#navbar-menu'
          aria-expanded={showSidebar}
          onClick={handleShowSidebar}
        >
          <span className='navbar-toggler-icon'></span>
        </button>
        <h1 className='navbar-brand'>
          <a href='/'>
            <img src={logo} width='60' height='60' alt='Opacity' className='navbar-brand-image' />
          </a>
          Opacity <span>v2.0.0</span>
        </h1>
      </div>
      <aside
        className={
          showSidebar
            ? "navbar navbar-vertical navbar-expand-lg navbar-transparent show"
            : "navbar navbar-vertical navbar-expand-lg navbar-transparent "
        }
      >
        <div className='container-fluid'>
          <h1 className='navbar-brand navbar-brand-autodark'>
            <a href='/'>
              <img src={logo} width='60' height='60' alt='Opacity' className='navbar-brand-image' />
            </a>
            Opacity <span>v2.0.0</span>
          </h1>
          <div className='collapse navbar-collapse' id='navbar-menu'>
            <ul className='navbar-nav'>
              <li className='nav-item'>
                <span className='nav-icon nav-icon-pro'>P</span>
                <Nav.Link>UPGRADE TO PRO</Nav.Link>
              </li>
              <UploadForm isDirectory={true} onSelected={selectFiles}>
                <li className='nav-item'>
                  <span className='nav-icon nav-icon-folder'></span>
                  <Nav.Link>UPLOAD FOLDER</Nav.Link>
                </li>
              </UploadForm>
              <UploadForm isDirectory={false} onSelected={selectFiles}>
                <li className='nav-item'>
                  <span className='nav-icon nav-icon-upload'></span>
                  <Nav.Link>UPLOAD FILE</Nav.Link>
                </li>
              </UploadForm>
              <li className='nav-item' onClick={handleLogout}>
                <span className='nav-icon nav-icon-logout'></span>
                <Nav.Link>LOGOUT</Nav.Link>
              </li>
            </ul>
            <div className='folder-tree'>
              <h3>Folders</h3>
              <TreeMenu data={treeData} hasSearch={false}>
                {({ search, items }) => (
                  <ul className='tree-menu'>
                    {items.map(({ key, ...props }) => (
                      <div key={key} className={props.isOpen ? "opened" : ""}>
                        <ItemComponent key={key} {...props} />
                      </div>
                    ))}
                  </ul>
                )}
              </TreeMenu>
            </div>
            <div className='account-info'>
              <div className='storage-info'>
                <span>{formatGbs(accountInfo ? accountInfo.account.storageUsed : 0)} </span> of {formatGbs(accountInfo ? accountInfo.account.storageLimit : 0)} used
              </div>
              <ProgressBar now={60} />
              <div className='upgrade text-right'>UPGRADE NOW</div>
              <div className='renew'>
                <p>Your account expires within 30 days</p>
                <div className='d-flex'>
                  <div className='account-icon'></div>
                  <span className='ml-3'>Renew account</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className='file-content' ref={drop}>
        {isActive && <div className='dnd-overlay'>
          <div className='content-wrapper'>
            <div className='overlay-content'>
              <img src={uploadImage} />
              <span>Drag your file to upload to Opacity</span>
            </div>
          </div>
        </div>}
        <div className='file-header'>
          <UploadForm isDirectory={false} onSelected={selectFiles}>
            <div className='d-flex header-item'>
              <span className='item-icon file-upload'></span>
              <span>FILE UPLOAD</span>
            </div>
          </UploadForm>
          <div className=' d-flex header-item ml-3' onClick={addNewFolder}>
            <span className='item-icon new-folder'></span>
            <span>NEW FOLDER</span>
          </div>
          {tableView && (
            <div className=' d-flex header-item ml-3'>
              <span
                className='item-icon grid-view'
                onClick={() => {
                  setTableView(false);
                }}
              ></span>
            </div>
          )}
          {!tableView && (
            <div className=' d-flex header-item ml-3'>
              <span
                className='item-icon table-view'
                onClick={() => {
                  setTableView(true);
                }}
              ></span>
            </div>
          )}
        </div>
        <div className='container-xl'>
          <div className='breadcrumb-content'>
            <Breadcrumb>
              <Breadcrumb.Item href='#' onClick={() => currentPath !== '/' && setCurrentPath('/')}>
                <span className='home-icon'></span>
              </Breadcrumb.Item>
              {currentPath !== '/' && subPaths.map(
                ({ text, path }, i) =>
                  i === subPaths.length - 1 ? (
                    <Breadcrumb.Item active key={i}>{text}</Breadcrumb.Item>
                  ) : (
                    <Breadcrumb.Item key={i} onClick={() => setCurrentPath(path)}>{text}</Breadcrumb.Item>
                  )
              )}
              {/*             
              <Breadcrumb.Item href='#'>Library</Breadcrumb.Item>
              <Breadcrumb.Item active>Data</Breadcrumb.Item> */}
            </Breadcrumb>
          </div>
          {!tableView && (
            <div className='grid-view'>
              {fileList.map((item, i) => (
                <div className='grid-item' key={i}>
                  <i className={`icon-${item.type}`}></i>
                  <h3 className='file-name'>{item.name}</h3>
                  <div className='file-info'>{item.size}</div>
                </div>
              ))}
            </div>
          )}
          {tableView && (
            <Table highlightRowOnHover hasOutline verticalAlign='center' className='text-nowrap'>
              <Table.Header>
                <tr>
                  <th style={{ width: "50%" }}>Name</th>
                  <th>Created</th>
                  <th>Size</th>
                  <th></th>
                </tr>
              </Table.Header>
              <Table.Body>
                {folderList.map((item, i) => (
                  <Table.Row key={i}>
                    <Table.Col className='file-name' onDoubleClick={() => setCurrentPath(item.path)}>
                      <div className='d-flex'>
                        <i className='icon-folder'></i>
                        {item.name}
                      </div>
                    </Table.Col>
                    <Table.Col>{moment(item.uploaded).calendar()}</Table.Col>
                    {/* <Table.Col>{moment(item.created).format("MM/DD/YYYY")}</Table.Col> */}
                    <Table.Col>{item.files.length} iteams</Table.Col>
                    <Table.Col className='text-nowrap'>
                      <DropdownButton menuAlign='right' title='' id='dropdown-menu-align-right'>
                        {/* <Dropdown.Item eventKey='1'>
                          <i className='icon-share'></i>
                          Share
                        </Dropdown.Item>
                        <Dropdown.Divider /> */}
                        {/* <Dropdown.Item eventKey='2'>
                          <i className='icon-download'></i>
                          Download
                        </Dropdown.Item>
                        <Dropdown.Divider /> */}
                        <Dropdown.Item eventKey='3' onClick={() => handleDeleteItem(item, false)}>
                          <i className='icon-delete'></i>
                          Delete
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item eventKey='4' onClick={() => handleOpenRenameModal(item, false)}>
                          <i className='icon-rename'></i>
                          Rename
                        </Dropdown.Item>
                      </DropdownButton>
                    </Table.Col>
                  </Table.Row>
                ))}
                {fileList.map((item, i) => (
                  <Table.Row key={i}>
                    <Table.Col className='file-name'>
                      <div className='d-flex'>
                        <i className={`icon-${item.type}`}></i>
                        {item.name}
                      </div>
                    </Table.Col>
                    <Table.Col>{moment(item.uploaded).calendar()}</Table.Col>
                    <Table.Col>{formatBytes(item.size)}</Table.Col>
                    <Table.Col className='text-nowrap'>
                      <DropdownButton menuAlign='right' title='' id='dropdown-menu-align-right'>
                        <Dropdown.Item eventKey='1' onClick={() => fileShare(item)}>
                          <i className='icon-share'></i>
                          Share
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item eventKey='2'>
                          <i className='icon-download'></i>
                          Download
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item eventKey='3' onClick={() => handleDeleteItem(item, true)}>
                          <i className='icon-delete'></i>
                          Delete
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item eventKey='4' onClick={() => handleOpenRenameModal(item, true)}>
                          <i className='icon-rename'></i>
                          Rename
                        </Dropdown.Item>
                      </DropdownButton>
                    </Table.Col>
                  </Table.Row>
                ))}
                {/* 
                <Table.Row className='selected'>
                  <Table.Col className='file-name'>
                    <div className='d-flex'>
                      <i className='icon-folder'></i>Movies
                    </div>
                  </Table.Col>
                  <Table.Col>Yesterday</Table.Col>
                  <Table.Col>8 items</Table.Col>
                  <Table.Col className='text-nowrap'>
                    <DropdownButton menuAlign='right' title='' id='dropdown-menu-align-right'>
                      <Dropdown.Item eventKey='1'>
                        <i className='icon-share'></i>
                        Share
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item eventKey='2'>
                        <i className='icon-download'></i>
                        Download
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item eventKey='3'>
                        <i className='icon-delete'></i>
                        Delete
                      </Dropdown.Item>
                      <Dropdown.Divider />
                      <Dropdown.Item eventKey='4'>
                        <i className='icon-rename'></i>
                        Rename
                      </Dropdown.Item>
                    </DropdownButton>
                  </Table.Col>
                </Table.Row> */}
              </Table.Body>
            </Table>
          )}
        </div>
      </div>

      {oldName && <RenameModal show={showRenameModal} handleClose={() => setShowRenameModal(false)} oldName={oldName} setNewName={handleChangeRename} />}
      <DeleteModal show={showDeleteModal} handleClose={() => setShowDeleteModal(false)} setDelete={handleDelete} />
      <ToastContainer
        pauseOnHover={false}
        draggable={true}
        progressClassName="toast-progress-bar"
        bodyClassName="toast-body"
        position="bottom-right"
        hideProgressBar
      />
    </div>
  );
};

const UploadForm = ({ children, onSelected, isDirectory }) => {
  const uploadFileInput = React.useRef<HTMLInputElement>(null);
  const uploadForm = React.useRef<HTMLFormElement>(null);

  const directory = {
    directory: "",
    webkitdirectory: "",
    mozkitdirectory: ""
  };

  const selectFiles = () => {
    let files = Array.from(uploadFileInput.current!.files || []);
    const filesLength = files.length;
    uploadForm.current!.reset();
    if (files.length > 0) {
      files = files.filter(file => file.size <= FILE_MAX_SIZE);
      files.length !== filesLength && alert("Some files are greater then 2GB.");
      onSelected(files);
    }
  };

  return (
    <div onClick={() => uploadFileInput.current!.click()}>
      {children}
      <form ref={uploadForm} style={{ display: "none" }}>
        <input
          type="file"
          id="file"
          ref={uploadFileInput}
          onChange={e => selectFiles()}
          multiple={true}
          {...isDirectory && { ...directory }}
        />
      </form>
    </div>

  );
}

const FileManagePageWrapper = ({ history }) => {
  return (
    <DndProvider backend={HTML5Backend}>
      <FileManagePage history={history} />
    </DndProvider>
  )

}
export default FileManagePageWrapper;